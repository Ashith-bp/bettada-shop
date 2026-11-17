require("./server/env");
const express = require("express");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cfg = require("./server/config");
const db = require("./server/db");
const auth = require("./server/auth");
const cf = require("./server/cashfree");
const U = require("./server/util");
const { fail } = U;

const app = express();
app.disable("x-powered-by");
app.use(compression());
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- security headers ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (cfg.isProduction) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  if (process.env.CSP !== "off") {
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' https://sdk.cashfree.com https://*.cashfree.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com",
      "img-src 'self' data: https://*.cashfree.com",
      "connect-src 'self' https://*.cashfree.com",
      "frame-src https://*.cashfree.com",
      "form-action 'self' https://*.cashfree.com",
      "base-uri 'self'"
    ].join("; "));
  }
  next();
});

/* ---------- Cashfree webhook (needs the raw body, so it comes before express.json) ---------- */
app.post("/api/cashfree/webhook", express.raw({ type: "*/*", limit: "100kb" }), wrap(async (req, res) => {
  const raw = req.body instanceof Buffer ? req.body.toString("utf8") : "";
  const ok = cf.verifyWebhook(raw, req.get("x-webhook-signature"), req.get("x-webhook-timestamp"));
  if (!ok) return res.status(401).json({ error: "Bad signature" });
  let evt = {};
  try { evt = JSON.parse(raw); } catch (e) { return res.status(200).json({ ok: true }); }
  const cfRef = evt && evt.data && evt.data.order && evt.data.order.order_id;
  if (cfRef && /SUCCESS|FAILED|DROPPED/i.test(String(evt.type || ""))) {
    const o = db.prepare("SELECT * FROM orders WHERE cf_ref=?").get(cfRef);
    if (o) { try { await syncPayment(o); } catch (e) { console.error("webhook sync failed", e.message); } }
  }
  res.json({ ok: true });
}));

app.use(express.json({ limit: "20kb" }));
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].indexOf(req.method) > -1 && !req.is("application/json")) return next(fail(415, "Invalid request."));
  next();
});
app.use(auth.loadUser);

/* ---------- catalogue and prices ---------- */
const BUSINESS_TYPES = ["Cafe or restaurant", "Coffee roaster", "Shop or retailer", "Wholesaler or trader", "Exporter", "Hotel or caterer", "Individual", "Other"];
function productImage(p) {
  /* A photo named <slug>.jpg in public/assets/products is picked up automatically. Otherwise the saved path, otherwise none. */
  try { if (p.slug && fs.existsSync(path.join(__dirname, "public", "assets", "products", p.slug + ".jpg"))) return "/assets/products/" + p.slug + ".jpg"; } catch (e) { /* ignore */ }
  return p.image || "";
}
function catalog() {
  const ps = db.prepare("SELECT * FROM products ORDER BY sort, id").all();
  const vs = db.prepare("SELECT * FROM variants ORDER BY grams").all();
  return ps.map((p) => {
    const variants = vs.filter((v) => v.product_id === p.id).map((v) => ({ id: v.id, label: v.label, grams: v.grams, price: v.price, inStock: !!v.in_stock }));
    return {
      id: p.id, slug: p.slug || p.id, category: p.category, name: p.name, tag: p.tag, art: p.art, image: productImage(p), tagline: p.tagline,
      description: p.description, moqKg: p.moq_kg || cfg.bulkMinKg,
      mode: variants.length ? "buy" : "quote",       /* products with a priced pack size are sold online, the rest are price on request */
      variants
    };
  });
}
function categories() {
  return db.prepare("SELECT * FROM categories ORDER BY sort, slug").all().map((c) => ({ slug: c.slug, name: c.name, art: c.art, blurb: c.blurb, description: c.description }));
}

app.get("/api/catalog", (req, res) => {
  res.json({
    brand: cfg.brand,
    products: catalog(),
    categories: categories(),
    bulkMinKg: cfg.bulkMinKg,
    businessTypes: BUSINESS_TYPES,
    states: U.STATES,
    freeAbove: cfg.shipping.freeAbove,
    maxQty: cfg.maxQtyPerLine,
    testMode: cf.isMock(),
    support: {
      whatsapp: cfg.whatsapp, phone: cfg.phone, phoneTel: cfg.phoneTel, email: cfg.email,
      addressLines: cfg.addressLines, fssai: cfg.fssai, gstin: cfg.gstin,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cfg.mapsQuery)
    },
    shipping: {
      freeAbove: cfg.shipping.freeAbove, homeState: cfg.shipping.homeState, rates: cfg.shipping.rates, kgPerBlock: cfg.shipping.kgPerBlock,
      southStates: cfg.shipping.southStates, remoteStates: cfg.shipping.remoteStates
    }
  });
});

/* Server-side pricing. The browser only sends variant ids and quantities. */
function priceItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 20) throw fail(400, "Your cart is empty.");
  const merged = {};
  items.forEach((it) => {
    const id = U.str(it && it.variantId, 60);
    const q = Math.floor(Number(it && it.qty));
    if (!id || !(q >= 1)) throw fail(400, "Something in your cart is not valid. Please refresh and try again.");
    merged[id] = (merged[id] || 0) + q;
  });
  const q = db.prepare("SELECT v.*, p.name AS pname FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?");
  const lines = []; let subtotal = 0, grams = 0;
  Object.keys(merged).forEach((id) => {
    const v = q.get(id);
    if (!v) throw fail(400, "One of the items in your cart is no longer sold. Please refresh the page.");
    if (!(v.price >= 1)) throw fail(400, "This item is not sold online. Please ask for a quote.");
    if (!v.in_stock) throw fail(409, v.pname + " (" + v.label + ") is out of stock right now. Remove it from your cart to continue.");
    if (merged[id] > cfg.maxQtyPerLine) throw fail(400, "For more than " + cfg.maxQtyPerLine + " packs of one item, please use the bulk order form.");
    const amount = v.price * merged[id];
    lines.push({ variantId: v.id, name: v.pname, label: v.label, price: v.price, grams: v.grams, qty: merged[id], amount });
    subtotal += amount; grams += v.grams * merged[id];
  });
  return { lines, subtotal, grams };
}

app.post("/api/quote", wrap(async (req, res) => {
  const r = priceItems(req.body && req.body.items);
  const state = U.str(req.body && req.body.state, 60);
  const known = U.STATES.indexOf(state) > -1;
  const shipping = known ? U.shippingFor(state, r.subtotal, r.grams) : null;
  res.json({ lines: r.lines, subtotal: r.subtotal, shipping, total: shipping == null ? null : r.subtotal + shipping, freeAbove: cfg.shipping.freeAbove });
}));

/* ---------- accounts ---------- */
const DUMMY_HASH = auth.hashPassword("not-a-real-password");

app.post("/api/auth/signup", auth.limit("auth", 10, 600000), wrap(async (req, res) => {
  const b = req.body || {};
  const name = U.str(b.name, 80), email = U.cleanEmail(b.email), phone = U.cleanPhone(b.phone), pw = String(b.password || "");
  if (name.length < 2) throw fail(400, "Enter your name.");
  if (!email) throw fail(400, "Enter a valid email address.");
  if (!phone) throw fail(400, "Enter a valid 10 digit mobile number.");
  if (pw.length < 8 || pw.length > 100) throw fail(400, "Choose a password with at least 8 characters.");
  if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) throw fail(409, "An account with this email already exists. Log in instead.");
  const r = db.prepare("INSERT INTO users (name,email,phone,pass_hash) VALUES (?,?,?,?)").run(name, email, phone, auth.hashPassword(pw));
  auth.startSession(res, r.lastInsertRowid);
  res.json({ user: { id: r.lastInsertRowid, name, email, phone, isAdmin: false } });
}));

app.post("/api/auth/login", auth.limit("auth", 10, 600000), wrap(async (req, res) => {
  const email = U.cleanEmail(req.body && req.body.email);
  const pw = String((req.body && req.body.password) || "");
  const row = email ? db.prepare("SELECT * FROM users WHERE email=?").get(email) : null;
  const ok = auth.checkPassword(pw, row ? row.pass_hash : DUMMY_HASH);
  if (!row || !ok) throw fail(401, "Email or password is incorrect.");
  auth.startSession(res, row.id);
  res.json({ user: { id: row.id, name: row.name, email: row.email, phone: row.phone, isAdmin: !!row.is_admin } });
}));

app.post("/api/auth/logout", (req, res) => { auth.endSession(req, res); res.json({ ok: true }); });
app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));

app.patch("/api/me", auth.requireUser, wrap(async (req, res) => {
  const name = U.str(req.body.name, 80), phone = U.cleanPhone(req.body.phone);
  if (name.length < 2) throw fail(400, "Enter your name.");
  if (!phone) throw fail(400, "Enter a valid 10 digit mobile number.");
  db.prepare("UPDATE users SET name=?, phone=? WHERE id=?").run(name, phone, req.user.id);
  res.json({ ok: true });
}));

app.post("/api/me/password", auth.requireUser, auth.limit("auth", 10, 600000), wrap(async (req, res) => {
  const row = db.prepare("SELECT pass_hash FROM users WHERE id=?").get(req.user.id);
  if (!auth.checkPassword(String(req.body.current || ""), row.pass_hash)) throw fail(400, "Your current password is not correct.");
  const np = String(req.body.next || "");
  if (np.length < 8 || np.length > 100) throw fail(400, "Choose a new password with at least 8 characters.");
  db.prepare("UPDATE users SET pass_hash=? WHERE id=?").run(auth.hashPassword(np), req.user.id);
  res.json({ ok: true });
}));

/* saved addresses */
app.get("/api/me/addresses", auth.requireUser, (req, res) => {
  res.json({ addresses: db.prepare("SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC").all(req.user.id) });
});
app.post("/api/me/addresses", auth.requireUser, wrap(async (req, res) => {
  const a = U.validAddress(req.body);
  const count = db.prepare("SELECT COUNT(*) c FROM addresses WHERE user_id=?").get(req.user.id).c;
  if (count >= 10) throw fail(400, "You can save up to 10 addresses. Delete one first.");
  const makeDefault = count === 0 || !!req.body.isDefault;
  db.transaction(() => {
    if (makeDefault) db.prepare("UPDATE addresses SET is_default=0 WHERE user_id=?").run(req.user.id);
    db.prepare("INSERT INTO addresses (user_id,name,phone,line1,line2,city,state,pincode,is_default) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(req.user.id, a.name, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, makeDefault ? 1 : 0);
  })();
  res.json({ ok: true });
}));
app.delete("/api/me/addresses/:id", auth.requireUser, (req, res) => {
  db.prepare("DELETE FROM addresses WHERE id=? AND user_id=?").run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});
app.post("/api/me/addresses/:id/default", auth.requireUser, (req, res) => {
  db.transaction(() => {
    db.prepare("UPDATE addresses SET is_default=0 WHERE user_id=?").run(req.user.id);
    db.prepare("UPDATE addresses SET is_default=1 WHERE id=? AND user_id=?").run(Number(req.params.id), req.user.id);
  })();
  res.json({ ok: true });
});

/* ---------- orders and payment ---------- */
function loadOrder(id) {
  const o = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!o) return null;
  o.items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(id);
  return o;
}
function publicOrder(o) {
  return {
    id: o.id, status: o.status, subtotal: o.subtotal, shipping: o.shipping, total: o.total,
    name: o.name, phone: o.phone, email: o.email,
    address: { line1: o.line1, line2: o.line2, city: o.city, state: o.state, pincode: o.pincode },
    items: o.items.map((i) => ({ name: i.name, label: i.label, price: i.price, qty: i.qty })),
    tracking: o.tracking, createdAt: o.created_at, paidAt: o.paid_at
  };
}
function sameToken(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
function canView(req, o, token) {
  return (req.user && (req.user.isAdmin || o.user_id === req.user.id)) || sameToken(token, o.access_token);
}
function getOrderFor(req, token, idOverride) {
  const o = loadOrder(U.str(idOverride || req.params.id, 20));
  if (!o || !canView(req, o, token)) throw fail(404, "We could not find that order.");
  return o;
}

async function startPayment(order, req) {
  const attempt = order.pay_attempt + 1;
  const cfRef = order.id + "_" + attempt;
  db.prepare("UPDATE orders SET pay_attempt=?, cf_ref=?, status='pending_payment' WHERE id=?").run(attempt, cfRef, order.id);
  if (cf.isMock()) return { mode: "mock", redirect: "/mock-pay.html?id=" + order.id + "&t=" + order.access_token };
  const origin = cfg.siteUrl || (req.protocol + "://" + req.get("host"));
  const r = await cf.createOrder({
    cfRef, orderId: order.id, amount: order.total,
    customerId: order.user_id ? "u" + order.user_id : "g" + order.id.replace(/[^A-Za-z0-9]/g, ""),
    name: order.name, email: order.email, phone: order.phone,
    returnUrl: origin + "/order.html?id=" + order.id + "&t=" + order.access_token,
    notifyUrl: origin.indexOf("https://") === 0 ? origin + "/api/cashfree/webhook" : undefined
  });
  return { mode: cfg.cashfree.mode, paymentSessionId: r.payment_session_id };
}

function markPaid(o, paymentId) {
  db.prepare("UPDATE orders SET status='paid', paid_at=datetime('now'), cf_payment_id=? WHERE id=? AND status IN ('pending_payment','payment_failed')")
    .run(paymentId || null, o.id);
}

/* Ask Cashfree what really happened. This is the only place an order becomes 'paid' (besides the test-mode page). */
async function syncPayment(o) {
  if (o.status !== "pending_payment" && o.status !== "payment_failed") return o;
  if (cf.isMock() || !o.cf_ref) return o;
  const cfo = await cf.getOrder(o.cf_ref);
  if (cfo.order_status === "PAID") {
    if (Math.abs(Number(cfo.order_amount) - o.total) > 0.01) { console.error("Amount mismatch on", o.id); return o; }
    let pid = null;
    try {
      const ps = await cf.getPayments(o.cf_ref);
      const good = (Array.isArray(ps) ? ps : []).find((p) => p.payment_status === "SUCCESS");
      pid = good ? String(good.cf_payment_id) : null;
    } catch (e) { /* payment id is optional */ }
    markPaid(o, pid);
  } else {
    try {
      const ps = await cf.getPayments(o.cf_ref);
      if (Array.isArray(ps) && ps.length && !ps.some((p) => p.payment_status === "SUCCESS" || p.payment_status === "PENDING")) {
        db.prepare("UPDATE orders SET status='payment_failed' WHERE id=? AND status='pending_payment'").run(o.id);
      }
    } catch (e) { /* keep waiting */ }
  }
  return loadOrder(o.id);
}

app.post("/api/orders", auth.limit("order", 20, 600000), wrap(async (req, res) => {
  const b = req.body || {};
  if (!cf.configured() && !cf.isMock()) throw fail(503, "Online payment is not switched on yet. Please try again later.");
  const r = priceItems(b.items);
  const a = U.validAddress(b.address);
  let email, userId = null;
  if (req.user) { email = req.user.email; userId = req.user.id; }
  else { email = U.cleanEmail(b.email); if (!email) throw fail(400, "Enter a valid email address so we can send you updates."); }
  const shipping = U.shippingFor(a.state, r.subtotal, r.grams);
  const total = r.subtotal + shipping;
  const id = U.orderId();
  const token = crypto.randomBytes(16).toString("hex");
  db.transaction(() => {
    db.prepare(`INSERT INTO orders (id,access_token,user_id,email,name,phone,line1,line2,city,state,pincode,subtotal,shipping,total,notes)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, token, userId, email, a.name, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, r.subtotal, shipping, total, U.str(b.notes, 300));
    const ins = db.prepare("INSERT INTO order_items (order_id,variant_id,name,label,price,grams,qty) VALUES (?,?,?,?,?,?,?)");
    r.lines.forEach((l) => ins.run(id, l.variantId, l.name, l.label, l.price, l.grams, l.qty));
    if (userId && b.saveAddress) {
      const has = db.prepare("SELECT COUNT(*) c FROM addresses WHERE user_id=?").get(userId).c;
      if (has < 10) db.prepare("INSERT INTO addresses (user_id,name,phone,line1,line2,city,state,pincode,is_default) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(userId, a.name, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, has === 0 ? 1 : 0);
    }
  })();
  let pay;
  try { pay = await startPayment(loadOrder(id), req); }
  catch (e) {
    console.error("Cashfree create order failed:", e.message, e.detail || "");
    throw fail(502, "We could not start the payment. Your order " + id + " is saved. Please try again from your order page.");
  }
  res.json(Object.assign({ orderId: id, token, orderUrl: "/order.html?id=" + id + "&t=" + token }, pay));
}));

app.get("/api/orders/:id", wrap(async (req, res) => {
  res.json({ order: publicOrder(getOrderFor(req, req.query.t)) });
}));

app.post("/api/orders/:id/verify", wrap(async (req, res) => {
  let o = getOrderFor(req, req.body && req.body.t);
  try { o = await syncPayment(o); } catch (e) { console.error("verify failed:", e.message); }
  res.json({ order: publicOrder(o) });
}));

app.post("/api/orders/:id/pay", auth.limit("order", 20, 600000), wrap(async (req, res) => {
  const o = getOrderFor(req, req.body && req.body.t);
  const synced = await syncPayment(o);
  if (synced.status !== "pending_payment" && synced.status !== "payment_failed") throw fail(409, "This order is already paid.");
  let pay;
  try { pay = await startPayment(loadOrder(o.id), req); }
  catch (e) { console.error("Cashfree retry failed:", e.message); throw fail(502, "We could not start the payment. Please try again in a minute."); }
  res.json(pay);
}));

/* Test mode only: lets you walk through the whole flow without Cashfree keys. */
app.post("/api/mock/pay", wrap(async (req, res) => {
  if (!cf.isMock()) throw fail(404, "Not found.");
  const o = getOrderFor(req, req.body && req.body.t, req.body && req.body.id);
  if (req.body.result === "success") markPaid(o, "TEST-" + Date.now());
  else db.prepare("UPDATE orders SET status='payment_failed' WHERE id=? AND status='pending_payment'").run(o.id);
  res.json({ ok: true });
}));

app.get("/api/me/orders", auth.requireUser, (req, res) => {
  const rows = db.prepare("SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100").all(req.user.id);
  res.json({ orders: rows.map((r) => publicOrder(loadOrder(r.id))) });
});

/* ---------- bulk enquiries ---------- */
app.post("/api/enquiries", auth.limit("enq", 6, 3600000), wrap(async (req, res) => {
  const b = req.body || {};
  const name = U.str(b.name, 80), phone = U.cleanPhone(b.phone);
  const email = b.email ? U.cleanEmail(b.email) : "";
  const kg = Math.floor(Number(b.kg));
  const state = U.str(b.state, 60), btype = U.str(b.businessType, 40), gstin = U.str(b.gstin, 15).toUpperCase();
  if (name.length < 2) throw fail(400, "Enter your name or business name.");
  if (!phone) throw fail(400, "Enter a valid 10 digit mobile number.");
  if (b.email && !email) throw fail(400, "That email address does not look right.");
  if (!(kg >= 5 && kg <= 100000)) throw fail(400, "Enter the quantity in kilos (at least 5).");
  if (state && U.STATES.indexOf(state) < 0) throw fail(400, "Choose your state from the list.");
  if (btype && BUSINESS_TYPES.indexOf(btype) < 0) throw fail(400, "Choose a business type from the list.");
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw fail(400, "That GST number does not look right. It has 15 letters and digits. Leave it empty if you do not have one.");
  db.prepare("INSERT INTO enquiries (name,phone,email,product,kg,city,notes,business_type,gstin,state) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(name, phone, email, U.str(b.product, 80), kg, U.str(b.city, 80), U.str(b.notes, 500), btype, gstin, state);
  res.json({ ok: true });
}));

/* ---------- contact messages ---------- */
app.post("/api/contact", auth.limit("contact", 5, 3600000), wrap(async (req, res) => {
  const b = req.body || {};
  const name = U.str(b.name, 80), phone = U.cleanPhone(b.phone), message = U.str(b.message, 1000);
  const email = b.email ? U.cleanEmail(b.email) : "";
  if (name.length < 2) throw fail(400, "Enter your name.");
  if (!phone) throw fail(400, "Enter a valid 10 digit mobile number so we can call you back.");
  if (b.email && !email) throw fail(400, "That email address does not look right.");
  if (message.length < 10) throw fail(400, "Write a short message (at least 10 characters).");
  db.prepare("INSERT INTO messages (name,phone,email,message) VALUES (?,?,?,?)").run(name, phone, email, message);
  res.json({ ok: true });
}));

/* ---------- admin ---------- */
const admin = express.Router();
admin.use(auth.requireUser, auth.requireAdmin);

admin.get("/orders", (req, res) => {
  const st = U.str(req.query.status, 30);
  const rows = st
    ? db.prepare("SELECT id FROM orders WHERE status=? ORDER BY created_at DESC LIMIT 300").all(st)
    : db.prepare("SELECT id FROM orders ORDER BY created_at DESC LIMIT 300").all();
  res.json({ orders: rows.map((r) => publicOrder(loadOrder(r.id))) });
});
admin.patch("/orders/:id", wrap(async (req, res) => {
  const o = loadOrder(U.str(req.params.id, 20));
  if (!o) throw fail(404, "Order not found.");
  const status = U.str(req.body.status, 20);
  const tracking = U.str(req.body.tracking, 120);
  const allowed = ["packed", "shipped", "delivered", "cancelled"];
  if (allowed.indexOf(status) < 0) throw fail(400, "Choose a valid status.");
  const unpaid = o.status === "pending_payment" || o.status === "payment_failed";
  if (unpaid && status !== "cancelled") throw fail(400, "This order has not been paid yet.");
  db.prepare("UPDATE orders SET status=?, tracking=? WHERE id=?").run(status, tracking, o.id);
  res.json({ ok: true });
}));
admin.get("/enquiries", (req, res) => res.json({ enquiries: db.prepare("SELECT * FROM enquiries ORDER BY id DESC LIMIT 300").all() }));
admin.patch("/enquiries/:id", (req, res) => {
  const st = U.str(req.body.status, 20);
  if (["new", "contacted", "closed"].indexOf(st) < 0) throw fail(400, "Choose a valid status.");
  db.prepare("UPDATE enquiries SET status=? WHERE id=?").run(st, Number(req.params.id));
  res.json({ ok: true });
});
admin.get("/messages", (req, res) => res.json({ messages: db.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 300").all() }));
admin.patch("/messages/:id", (req, res) => {
  const st = U.str(req.body.status, 20);
  if (["new", "done"].indexOf(st) < 0) throw fail(400, "Choose a valid status.");
  db.prepare("UPDATE messages SET status=? WHERE id=?").run(st, Number(req.params.id));
  res.json({ ok: true });
});
admin.get("/products", (req, res) => res.json({ products: catalog() }));
admin.post("/variants", (req, res) => {
  const pid = U.str(req.body.productId, 60), label = U.str(req.body.label, 30);
  const grams = Math.floor(Number(req.body.grams)), price = Math.floor(Number(req.body.price));
  if (!db.prepare("SELECT id FROM products WHERE id=?").get(pid)) throw fail(404, "Choose a product.");
  if (label.length < 2) throw fail(400, "Enter a pack label such as 250 g or 5 kg.");
  if (!(grams >= 50 && grams <= 100000)) throw fail(400, "Enter the pack weight in grams, between 50 and 100000.");
  if (!(price >= 1 && price <= 1000000)) throw fail(400, "Enter a price between 1 and 1000000.");
  const id = pid + "-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "") ;
  if (db.prepare("SELECT id FROM variants WHERE id=?").get(id)) throw fail(409, "That pack size already exists for this product.");
  db.prepare("INSERT INTO variants (id,product_id,label,grams,price) VALUES (?,?,?,?,?)").run(id, pid, label, grams, price);
  res.json({ ok: true, id });
});
admin.delete("/variants/:id", (req, res) => {
  db.prepare("DELETE FROM variants WHERE id=?").run(U.str(req.params.id, 80));
  res.json({ ok: true });
});
admin.patch("/variants/:id", (req, res) => {
  const price = Math.floor(Number(req.body.price));
  if (!(price >= 1 && price <= 1000000)) throw fail(400, "Enter a price between 1 and 1000000.");
  const r = db.prepare("UPDATE variants SET price=?, in_stock=? WHERE id=?").run(price, req.body.inStock ? 1 : 0, U.str(req.params.id, 60));
  if (!r.changes) throw fail(404, "Item not found.");
  res.json({ ok: true });
});
app.use("/api/admin", admin);

/* ---------- pages ---------- */
const siteOrigin = (req) => cfg.siteUrl || (req.protocol + "://" + req.get("host"));
const escA = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const abs = (o, u) => (/^https?:\/\//.test(u) ? u : o + u);

/* Sends a page with its own title, description, canonical link and share tags filled in (good for Google and for link previews) */
function sendPage(req, res, file, meta) {
  const o = siteOrigin(req);
  const url = o + (meta.path || req.path);
  const img = abs(o, meta.image || "/assets/og-image.jpg");
  let html = fs.readFileSync(path.join(__dirname, "public", file), "utf8");
  const tags = [
    '<link rel="canonical" href="' + escA(url) + '">',
    '<meta property="og:site_name" content="' + escA(cfg.brand) + '">',
    '<meta property="og:title" content="' + escA(meta.title) + '">',
    '<meta property="og:description" content="' + escA(meta.description) + '">',
    '<meta property="og:type" content="' + (meta.ogType || "website") + '">',
    '<meta property="og:url" content="' + escA(url) + '">',
    '<meta property="og:image" content="' + escA(img) + '">',
    '<meta name="twitter:card" content="summary_large_image">'
  ];
  (meta.jsonld || []).forEach((j) => tags.push('<script type="application/ld+json">' + JSON.stringify(j).replace(/</g, "\\u003c") + "</script>"));
  html = html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + escA(meta.title) + "</title>")
    .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="' + escA(meta.description) + '">')
    .replace("<!--SEO-->", tags.join("\n"));
  res.type("html").send(html);
}
const addressObj = () => ({ "@type": "PostalAddress", streetAddress: cfg.addressLines[0], addressLocality: "Chikkamagaluru", addressRegion: "Karnataka", postalCode: "577133", addressCountry: "IN" });
const storeLd = (o) => ({ "@context": "https://schema.org", "@type": "Store", name: cfg.brand, url: o, image: o + "/assets/og-image.jpg", logo: o + "/assets/logo.png",
  description: "Arabica and Robusta coffee and black pepper grown on our estate in Chikkamagaluru, Karnataka. Sold by the pack and in bulk across India.",
  telephone: cfg.phoneTel, email: cfg.email, address: addressObj(), areaServed: "IN" });

const BRAND = cfg.brand;
const STATIC_PAGES = {
  "/": ["index.html", BRAND + " | Pure Estate Coffee and Kalumenasu Black Pepper from Chikkamagaluru", "Pure Arabica and Robusta coffee powder and sun-dried Kalumenasu black pepper from our Chikkamagaluru estate. Buy online by the pack or order in bulk across India."],
  "/shop": ["shop.html", "Shop coffee and black pepper online | " + BRAND, "Browse Arabica coffee powder, Arabica and Robusta grades and black pepper from our Chikmagalur estate. Buy online or ask for a bulk price."],
  "/collections": ["collections.html", "Collections | " + BRAND, "Shop by category: coffee powders, Arabica coffee, Robusta coffee and black pepper from our estate in Chikmagalur."],
  "/bulk": ["bulk.html", "Bulk and export supply across India | " + BRAND, "Sun-dried, export-quality Arabica, Robusta and black pepper (MG1, TGSEB, FAQ) supplied in bulk across India. Send an enquiry for a price."],
  "/grades": ["grades.html", "Our grades: Arabica, Robusta and black pepper | " + BRAND, "Learn about Arabica Plantation A/B, Peaberry and Cherry, Robusta Cherry AB and Kaapi Royale, and black pepper MG1, TGSEB and FAQ."],
  "/about": ["about.html", "Our estate in Chikmagalur | " + BRAND, "The story of Bettada Estate in Billenahalli, Chikkamagaluru, where we grow coffee and black pepper, dry it in the sun and pack it ourselves."],
  "/faq": ["faq.html", "Questions and answers | " + BRAND, "Answers about ordering, payment, delivery, bulk orders and our coffee and pepper."],
  "/contact": ["contact.html", "Contact us | " + BRAND, "Contact Bettada Estate by phone, WhatsApp or email, or find our estate address in Billenahalli, Chikkamagaluru, Karnataka."],
  "/privacy": ["privacy.html", "Privacy policy | " + BRAND, "How " + BRAND + " collects and uses your information."],
  "/terms": ["terms.html", "Terms and conditions | " + BRAND, "The terms for buying from " + BRAND + "."],
  "/shipping-policy": ["shipping-policy.html", "Shipping and delivery | " + BRAND, "Delivery charges, dispatch and delivery times for orders from " + BRAND + "."],
  "/refund-policy": ["refund-policy.html", "Refunds and cancellations | " + BRAND, "How cancellations, damaged orders and refunds work at " + BRAND + "."]
};
Object.keys(STATIC_PAGES).forEach((u) => {
  const [file, title, description] = STATIC_PAGES[u];
  app.get(u === "/" ? ["/", "/index.html"] : [u, u + ".html"], (req, res) => {
    const o = siteOrigin(req);
    sendPage(req, res, file, { title, description, path: u, jsonld: u === "/" ? [storeLd(o)] : [] });
  });
});

app.get("/collections/:slug", (req, res, next) => {
  const c = categories().filter((x) => x.slug === req.params.slug)[0];
  if (!c) return next();
  sendPage(req, res, "collection.html", { title: c.name + " | " + BRAND, description: c.description, path: "/collections/" + c.slug });
});
app.get("/products/:slug", (req, res, next) => {
  const p = catalog().filter((x) => x.slug === req.params.slug)[0];
  if (!p) return next();
  const o = siteOrigin(req), url = o + "/products/" + p.slug;
  const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: String(p.description).split("\n")[0], brand: { "@type": "Brand", name: cfg.brand }, url,
    category: (categories().filter((c) => c.slug === p.category)[0] || {}).name || "" };
  if (p.image) ld.image = abs(o, p.image);
  if (p.mode === "buy") {
    const prices = p.variants.map((v) => v.price);
    ld.offers = { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: Math.min.apply(null, prices), highPrice: Math.max.apply(null, prices), offerCount: prices.length,
      availability: p.variants.some((v) => v.inStock) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url };
  }
  sendPage(req, res, "product.html", { title: p.name + " | " + BRAND, description: p.tagline + ". " + String(p.description).split("\n")[0], path: "/products/" + p.slug, image: p.image, ogType: "product", jsonld: [ld] });
});

const PUBLIC_PAGES = Object.keys(STATIC_PAGES);
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /order\nDisallow: /login\nDisallow: /api/\n\nSitemap: " + siteOrigin(req) + "/sitemap.xml\n");
});
app.get("/sitemap.xml", (req, res) => {
  const o = siteOrigin(req);
  const urls = PUBLIC_PAGES.concat(categories().map((c) => "/collections/" + c.slug), catalog().map((p) => "/products/" + p.slug));
  res.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => "  <url><loc>" + o + u + "</loc></url>").join("\n") + "\n</urlset>\n");
});
app.get("/healthz", (req, res) => res.send("ok"));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: cfg.isProduction ? "1h" : 0 }));
app.use((req, res) => {
  if (req.path.indexOf("/api/") === 0) return res.status(404).json({ error: "Not found." });
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request." });
  if (err instanceof U.HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

const hasAdmin = auth.seedAdmin();
app.listen(cfg.port, () => {
  console.log("\n" + cfg.brand + " shop running on http://localhost:" + cfg.port);
  console.log(cf.configured() ? "Payments: Cashfree (" + cfg.cashfree.mode + ")" : cfg.isProduction ? "Payments: NOT CONFIGURED. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY." : "Payments: TEST MODE (fake payment page, no real money)");
  console.log(hasAdmin ? "Admin login: " + cfg.admin.email : "Admin: not set. Add ADMIN_EMAIL and ADMIN_PASSWORD to .env");
});
