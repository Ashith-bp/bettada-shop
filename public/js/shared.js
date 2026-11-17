/* Shared by every page: API helper, cart, header, footer, cart drawer. */
(function () {
  "use strict";
  var BE = (window.BE = {});
  var STORE = "bettada-cart-v2";

  BE.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  BE.inr = function (n) { return "₹" + Number(n).toLocaleString("en-IN"); };
  BE.$ = function (id) { return document.getElementById(id); };

  BE.api = function (path, opts) {
    opts = opts || {};
    var o = { method: opts.method || "GET", credentials: "same-origin", headers: {} };
    if (o.method !== "GET") { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(opts.body || {}); }
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || "Something went wrong. Please try again."); e.status = r.status; throw e; }
        return d;
      });
    });
  };

  var catP = null;
  BE.catalog = function () { if (!catP) catP = BE.api("/api/catalog"); return catP; };
  BE.findVariant = function (cat, id) {
    for (var i = 0; i < cat.products.length; i++) {
      var p = cat.products[i];
      for (var j = 0; j < p.variants.length; j++) if (p.variants[j].id === id) return { product: p, variant: p.variants[j] };
    }
    return null;
  };

  /* ---------- cart (kept in the browser, priced again by the server at checkout) ---------- */
  var cart = [];
  try {
    cart = JSON.parse(localStorage.getItem(STORE) || "[]").filter(function (c) { return c && typeof c.variantId === "string" && c.qty > 0; });
  } catch (e) { cart = []; }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (e) { /* private mode */ }
    document.dispatchEvent(new Event("cart-change"));
  }
  BE.cart = {
    items: function () { return cart.map(function (c) { return { variantId: c.variantId, qty: c.qty }; }); },
    count: function () { return cart.reduce(function (n, c) { return n + c.qty; }, 0); },
    add: function (id, q) {
      var hit = cart.filter(function (c) { return c.variantId === id; })[0];
      if (hit) hit.qty = Math.min(20, hit.qty + (q || 1)); else cart.push({ variantId: id, qty: q || 1 });
      save();
    },
    setQty: function (id, q) {
      cart.forEach(function (c) { if (c.variantId === id) c.qty = Math.min(20, q); });
      cart = cart.filter(function (c) { return c.qty > 0; });
      save();
    },
    remove: function (id) { cart = cart.filter(function (c) { return c.variantId !== id; }); save(); },
    clear: function () { cart = []; save(); }
  };

  /* ---------- snack bar ---------- */
  var snackTimer;
  BE.snack = function (msg, withCart) {
    var s = BE.$("snack");
    if (!s) return;
    s.innerHTML = "<span>" + BE.esc(msg) + "</span>" + (withCart ? '<button type="button" id="snackView">View cart</button>' : "");
    s.hidden = false;
    if (withCart) BE.$("snackView").addEventListener("click", function () { s.hidden = true; BE.openCart(); });
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { s.hidden = true; }, 4500);
  };

  /* ---------- WhatsApp helpers ---------- */
  BE.wa = function (text) {
    var n = (BE.cat && BE.cat.support.whatsapp) || "";
    return "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "");
  };
  var WA_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true" width="26" height="26"><path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.8 2 6.8L3.4 29l6.6-1.7c1.9 1 4 1.6 6.1 1.6 7.2 0 13-5.7 13-12.8S23.2 3 16 3z"/><path fill="#25D366" d="M22.3 19.200c-.3-.2-1.900-.9-2.200-1s-.5-.2-.7.200c-.2.300-.8 1-1 1.200-.2.200-.4.200-.7.100-1.900-.9-3.100-1.700-4.300-3.700-.3-.6.300-.5.900-1.700.1-.2 0-.4 0-.5l-1-2.300c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1.100 1.100-1.100 2.600s1.100 3 1.300 3.200c.2.200 2.200 3.400 5.400 4.700 2 .8 2.800.9 3.800.7.600-.1 1.900-.8 2.100-1.500.3-.700.3-1.400.2-1.500-.1-.2-.3-.3-.6-.4z"/></svg>';

  /* ---------- illustrations (used where a product has no photo yet) ---------- */
  BE.ART = {
    cherry: '<svg viewBox="0 0 200 200" role="img" aria-label="Ripe coffee cherries on a branch"><path d="M100 14C96 54 70 78 52 112M100 14C104 54 130 78 148 112" stroke="#12301F" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M100 14c20-12 46-6 56 10-24 8-46 4-56-10z" fill="#CFDCC4"/><path d="M100 14c-18-10-40-6-50 8 20 8 40 4 50-8z" fill="#CFDCC4"/><circle cx="52" cy="132" r="34" fill="#F2F1E8"/><circle cx="148" cy="132" r="34" fill="#F2F1E8"/><circle cx="52" cy="132" r="28" fill="#8E1F17"/><circle cx="148" cy="132" r="28" fill="#8E1F17"/><circle cx="41" cy="120" r="7" fill="#fff" opacity=".35"/><circle cx="137" cy="120" r="7" fill="#fff" opacity=".35"/><circle cx="100" cy="116" r="24" fill="#F2F1E8"/><circle cx="100" cy="116" r="19" fill="#B02A24"/><circle cx="93" cy="108" r="5" fill="#fff" opacity=".35"/></svg>',
    bean: '<svg viewBox="0 0 200 200" role="img" aria-label="Coffee beans"><ellipse cx="76" cy="98" rx="48" ry="64" transform="rotate(-24 76 98)" fill="#F2F1E8"/><ellipse cx="76" cy="98" rx="42" ry="58" transform="rotate(-24 76 98)" fill="#6B4630"/><path d="M60 46c26 22 2 50 30 104" stroke="#F2F1E8" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="136" cy="120" rx="36" ry="48" transform="rotate(20 136 120)" fill="#F2F1E8"/><ellipse cx="136" cy="120" rx="31" ry="43" transform="rotate(20 136 120)" fill="#523520"/><path d="M142 82c-18 18 2 38-14 78" stroke="#F2F1E8" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
    pepper: '<svg viewBox="0 0 200 200" role="img" aria-label="Black pepper vine with peppercorns"><path d="M20 24C60 8 110 36 180 14" stroke="#CFDCC4" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M60 26c0 30-6 40 6 60M104 32c0 30 8 44-4 70M146 28c0 28-10 46 2 72" stroke="#CFDCC4" stroke-width="3.5" fill="none"/><g fill="#F2F1E8"><circle cx="66" cy="48" r="11"/><circle cx="62" cy="68" r="11"/><circle cx="68" cy="88" r="11"/><circle cx="104" cy="54" r="11"/><circle cx="108" cy="74" r="11"/><circle cx="104" cy="94" r="11"/><circle cx="100" cy="114" r="11"/><circle cx="146" cy="50" r="11"/><circle cx="142" cy="70" r="11"/><circle cx="148" cy="90" r="11"/><circle cx="146" cy="110" r="11"/></g><g fill="#24160F"><circle cx="66" cy="48" r="8.5"/><circle cx="62" cy="68" r="8.5"/><circle cx="68" cy="88" r="8.5"/><circle cx="104" cy="54" r="8.5"/><circle cx="108" cy="74" r="8.5"/><circle cx="104" cy="94" r="8.5"/><circle cx="100" cy="114" r="8.5"/><circle cx="146" cy="50" r="8.5"/><circle cx="142" cy="70" r="8.5"/><circle cx="148" cy="90" r="8.5"/><circle cx="146" cy="110" r="8.5"/></g><ellipse cx="64" cy="152" rx="30" ry="12" fill="#CFDCC4" transform="rotate(-18 64 152)"/><ellipse cx="136" cy="156" rx="32" ry="12" fill="#CFDCC4" transform="rotate(16 136 156)"/><g fill="#F2F1E8"><circle cx="86" cy="178" r="9"/><circle cx="104" cy="182" r="9"/><circle cx="122" cy="178" r="9"/></g><g fill="#24160F"><circle cx="86" cy="178" r="6.5"/><circle cx="104" cy="182" r="6.5"/><circle cx="122" cy="178" r="6.5"/></g></svg>',
    powder: '<svg viewBox="0 0 200 200" role="img" aria-label="Ground coffee"><ellipse cx="100" cy="150" rx="82" ry="16" fill="#3B2415"/><path d="M22 148C32 96 66 62 100 62s68 34 78 86z" fill="#6B4630"/><g fill="#8A5E40"><circle cx="70" cy="110" r="3"/><circle cx="96" cy="92" r="3"/><circle cx="124" cy="104" r="3"/><circle cx="108" cy="126" r="3"/><circle cx="82" cy="134" r="3"/><circle cx="140" cy="130" r="3"/></g><path d="M150 40l20-14 8 12-20 14z" fill="#F2F1E8"/></svg>'
  };
  BE.art = function (n) { return BE.ART[n] || BE.ART.cherry; };

  /* ---------- catalogue helpers ---------- */
  BE.category = function (slug) { return (BE.cat.categories || []).filter(function (c) { return c.slug === slug; })[0]; };
  BE.productsIn = function (slug) { return BE.cat.products.filter(function (p) { return p.category === slug; }); };
  BE.productBySlug = function (slug) { return BE.cat.products.filter(function (p) { return p.slug === slug; })[0]; };
  BE.fromPrice = function (p) {
    if (p.mode !== "buy") return null;
    var live = p.variants.filter(function (v) { return v.inStock; });
    return Math.min.apply(null, (live.length ? live : p.variants).map(function (v) { return v.price; }));
  };
  BE.priceLabel = function (p) { var f = BE.fromPrice(p); return f == null ? "Price on request" : "From " + BE.inr(f); };
  BE.mediaHtml = function (p, lazy) {
    if (p.image) return '<div class="pmedia photo"><img src="' + BE.esc(p.image) + '" alt="' + BE.esc(p.name) + '" width="1000" height="750"' + (lazy === false ? "" : ' loading="lazy"') + "></div>";
    return '<div class="pmedia m-' + BE.esc(p.art) + '">' + BE.art(p.art) + "</div>";
  };
  BE.categoryMedia = function (c) {
    var withPhoto = BE.productsIn(c.slug).filter(function (p) { return p.image; })[0];
    if (withPhoto) return '<div class="pmedia photo"><img src="' + BE.esc(withPhoto.image) + '" alt="" width="1000" height="750" loading="lazy"></div>';
    return '<div class="pmedia m-' + BE.esc(c.art) + '">' + BE.art(c.art) + "</div>";
  };
  BE.productCard = function (p) {
    var href = "/products/" + encodeURIComponent(p.slug), buy = p.mode === "buy";
    return '<article class="pcard"><a class="pcard-media" href="' + href + '" tabindex="-1" aria-hidden="true">' + BE.mediaHtml(p) + '<span class="chip">' + BE.esc(p.tag) + "</span></a>" +
      '<div class="pcard-body"><h3><a href="' + href + '">' + BE.esc(p.name) + "</a></h3>" +
      '<p class="tagline">' + BE.esc(p.tagline) + "</p>" +
      '<div class="pcard-foot"><span class="pcard-price' + (buy ? "" : " quote") + '">' + BE.esc(BE.priceLabel(p)) + '</span><a class="btn small ' + (buy ? "cherry" : "outline-dark") + '" href="' + href + '">' + (buy ? "Choose pack" : "Get a quote") + "</a></div></div></article>";
  };
  BE.crumbs = function (list) {
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>' + list.map(function (c, i) {
      return "<li>" + (c[1] && i < list.length - 1 ? '<a href="' + BE.esc(c[1]) + '">' + BE.esc(c[0]) + "</a>" : '<span aria-current="page">' + BE.esc(c[0]) + "</span>") + "</li>";
    }).join("") + "</ol></nav>";
  };

  /* ---------- quote / bulk enquiry form (used on the bulk page and on grade pages) ---------- */
  var enqCount = 0;
  BE.enquiryForm = function (host, opts) {
    opts = opts || {};
    var n = "q" + (++enqCount), full = !!opts.full, cat = BE.cat;
    var products = cat.products.map(function (p) { return p.name; });
    var prodSel = opts.product && !opts.pickProduct ? '<input type="hidden" id="' + n + 'Prod" value="' + BE.esc(opts.product) + '">' :
      '<label for="' + n + 'Prod">What do you need<select id="' + n + 'Prod">' + products.concat(["Several products"]).map(function (x) { return "<option" + (x === opts.product ? " selected" : "") + ">" + BE.esc(x) + "</option>"; }).join("") + "</select></label>";
    var states = '<option value="">Choose a state</option>' + cat.states.map(function (x) { return "<option>" + BE.esc(x) + "</option>"; }).join("");
    var types = '<option value="">Choose one</option>' + cat.businessTypes.map(function (x) { return "<option>" + BE.esc(x) + "</option>"; }).join("");
    host.innerHTML =
      '<form class="form-card" id="' + n + 'Form" novalidate>' +
      '<div class="two"><label for="' + n + 'Name">Name or business<input id="' + n + 'Name" type="text" autocomplete="organization"></label>' +
      '<label for="' + n + 'Phone">Mobile number<input id="' + n + 'Phone" type="tel" autocomplete="tel" inputmode="tel"></label></div>' +
      (full ? '<div class="two"><label for="' + n + 'Email">Email (optional)<input id="' + n + 'Email" type="email" autocomplete="email"></label>' +
        '<label for="' + n + 'Type">Your business<select id="' + n + 'Type">' + types + "</select></label></div>" : "") +
      '<div class="two">' + prodSel + '<label for="' + n + 'Kg">Quantity in kg<input id="' + n + 'Kg" type="number" min="5" step="5" value="' + (opts.kg || cat.bulkMinKg) + '"></label></div>' +
      '<div class="two"><label for="' + n + 'City">City to deliver to<input id="' + n + 'City" type="text" autocomplete="address-level2"></label>' +
      '<label for="' + n + 'State">State<select id="' + n + 'State">' + states + "</select></label></div>" +
      (full ? '<label for="' + n + 'Gst">GST number (optional)<input id="' + n + 'Gst" type="text" maxlength="15" autocomplete="off"></label>' : "") +
      '<label for="' + n + 'Notes">Anything else<textarea id="' + n + 'Notes" rows="3" placeholder="How often, how it should be packed, when you need it"></textarea></label>' +
      '<p class="error" id="' + n + 'Err" role="alert"></p>' +
      '<p class="notice good" id="' + n + 'Done" hidden>Thank you. We have your enquiry and will call you soon with a price.</p>' +
      '<div class="actions"><button type="submit" class="btn forest-btn" id="' + n + 'Btn">Send enquiry</button>' +
      '<a class="btn wa" id="' + n + 'Wa" href="#" target="_blank" rel="noopener">Ask on WhatsApp</a></div>' +
      '<p class="small">We use your details only to reply to this enquiry.</p></form>';
    function v(id) { var el = BE.$(n + id); return el ? el.value : ""; }
    function waText() {
      var t = "Hello " + cat.brand + ", I would like a price for " + v("Prod") + ", " + (v("Kg") || "?") + " kg.";
      if (v("Name").trim()) t += "\nName: " + v("Name").trim();
      if (v("City").trim()) t += "\nDeliver to: " + v("City").trim() + (v("State") ? ", " + v("State") : "");
      return t;
    }
    function refresh() { BE.$(n + "Wa").setAttribute("href", BE.wa(waText())); }
    refresh();
    host.querySelector("form").addEventListener("input", refresh);
    host.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      BE.$(n + "Err").textContent = ""; BE.$(n + "Done").hidden = true; BE.$(n + "Btn").disabled = true;
      BE.api("/api/enquiries", { method: "POST", body: { name: v("Name"), phone: v("Phone"), email: v("Email"), businessType: v("Type"), product: v("Prod"), kg: v("Kg"), city: v("City"), state: v("State"), gstin: v("Gst"), notes: v("Notes") } })
        .then(function () { BE.$(n + "Done").hidden = false; ["Name", "Phone", "Email", "City", "Gst", "Notes"].forEach(function (k) { var el = BE.$(n + k); if (el) el.value = ""; }); })
        .catch(function (err) { BE.$(n + "Err").textContent = err.message; })
        .then(function () { BE.$(n + "Btn").disabled = false; });
    });
  };

  /* ---------- page frame ---------- */
  function addressHtml(s, sep) { return s.addressLines.map(BE.esc).join(sep || "<br>"); }
  function navLink(href, label, re) {
    var on = re ? re.test(location.pathname) : location.pathname === href;
    return '<a href="' + href + '"' + (on ? ' aria-current="page"' : "") + ">" + label + "</a>";
  }

  function headerHtml(cat, user) {
    var s = cat.support;
    var acct = user
      ? '<a href="/account.html" class="acct">' + BE.esc((user.name || "Account").split(" ")[0]) + "</a>"
      : '<a href="/login.html" class="acct">Log in</a>';
    var acctMobile = user ? '<a href="/account.html" class="only-mobile">Your account</a>' : '<a href="/login.html" class="only-mobile">Log in or sign up</a>';
    var subs = cat.categories.map(function (c) { return '<a href="/collections/' + BE.esc(c.slug) + '">' + BE.esc(c.name) + "</a>"; }).join("");
    return (
      (cat.testMode ? '<div class="testbar">Test mode. Payments on this site are simulated and no money is taken.</div>' : "") +
      '<div class="infobar"><div class="wrap infobar-row">' +
      '<span class="info-item info-loc">' + addressHtml(s, ", ") + "</span>" +
      '<span class="info-links"><a href="tel:' + BE.esc(s.phoneTel) + '">Call ' + BE.esc(s.phone) + '</a>' +
      '<a class="info-mail" href="mailto:' + BE.esc(s.email) + '">' + BE.esc(s.email) + "</a></span>" +
      "</div></div>" +
      '<header class="top"><div class="wrap top-row">' +
      '<a class="brand" href="/" aria-label="' + BE.esc(cat.brand) + ' home">' +
      '<img src="/assets/logo.png" alt="" width="46" height="46"><span>' + BE.esc(cat.brand) + "</span></a>" +
      '<nav class="menu" id="mainMenu" aria-label="Main">' +
      navLink("/shop", "Shop", /^\/(shop|products)/) +
      '<div class="has-sub">' + navLink("/collections", "Collections", /^\/collections/) + '<div class="sub">' + subs + '<a href="/collections">All collections</a></div></div>' +
      navLink("/bulk", "Bulk and export") + navLink("/grades", "Our grades") + navLink("/about", "About") + navLink("/contact", "Contact", /^\/contact/) + acctMobile + "</nav>" +
      '<div class="top-actions">' + acct + (user && user.isAdmin ? '<a href="/admin.html" class="acct">Admin</a>' : "") +
      '<button type="button" class="cart-btn" id="openCart" aria-haspopup="dialog">Cart <span class="count" id="cartCount">0</span></button>' +
      '<button type="button" class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="mainMenu">Menu</button></div>' +
      "</div></header>"
    );
  }
  function footerHtml(cat) {
    var s = cat.support, y = new Date().getFullYear();
    var legal = [];
    if (s.fssai) legal.push("FSSAI Lic. No. " + BE.esc(s.fssai));
    if (s.gstin) legal.push("GSTIN " + BE.esc(s.gstin));
    var shop = cat.categories.map(function (c) { return '<li><a href="/collections/' + BE.esc(c.slug) + '">' + BE.esc(c.name) + "</a></li>"; }).join("");
    return (
      '<footer class="band roast site-foot"><div class="wrap">' +
      '<div class="foot-grid">' +
      '<div class="foot-brand"><div class="foot-logo"><img src="/assets/logo.png" alt="" width="64" height="64"><b>' + BE.esc(cat.brand) + "</b></div>" +
      "<p>Coffee and black pepper grown, sun-dried and packed on our estate in Chikkamagalur, Karnataka. Sold by the pack and in bulk across India.</p></div>" +
      '<div><h3>Shop</h3><ul>' + shop + '<li><a href="/shop">All products</a></li></ul></div>' +
      '<div><h3>Company</h3><ul><li><a href="/about">About our estate</a></li><li><a href="/grades">Our grades</a></li><li><a href="/bulk">Bulk and export</a></li><li><a href="/faq">Questions and answers</a></li><li><a href="/contact">Contact us</a></li><li><a href="/account.html">Track your order</a></li></ul></div>' +
      '<div><h3>Policies</h3><ul><li><a href="/shipping-policy">Shipping and delivery</a></li><li><a href="/refund-policy">Refunds and cancellations</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms and conditions</a></li></ul></div>' +
      '<div><h3>Contact</h3><address><p>' + addressHtml(s) + '</p>' +
      '<p><a href="tel:' + BE.esc(s.phoneTel) + '">' + BE.esc(s.phone) + '</a></p>' +
      '<p><a href="mailto:' + BE.esc(s.email) + '">' + BE.esc(s.email) + "</a></p>" +
      '<p><a class="foot-wa" href="' + BE.esc(BE.wa("Hello " + cat.brand + ", I have a question.")) + '" target="_blank" rel="noopener">Chat on WhatsApp</a></p>' +
      '<p><a href="' + BE.esc(s.mapsUrl) + '" target="_blank" rel="noopener">Get directions</a></p></address></div>' +
      "</div>" +
      '<div class="foot-bottom"><p>&copy; ' + y + " " + BE.esc(cat.brand) + ". All rights reserved.</p>" +
      "<p>" + (legal.length ? legal.join(" · ") + " · " : "") + "Secure payments by Cashfree. Prices are in Indian rupees.</p></div>" +
      "</div></footer>" +
      '<a class="wa-float" href="' + BE.esc(BE.wa("Hello " + cat.brand + ", I have a question about your coffee and pepper.")) + '" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">' + WA_ICON + "<span>Chat on WhatsApp</span></a>"
    );
  }
  var drawerHtml =
    '<div class="overlay" id="overlay" hidden></div>' +
    '<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle" aria-hidden="true">' +
    '<div class="drawer-head"><h2 id="drawerTitle">Your cart</h2><button type="button" class="close" id="closeCart">Close</button></div>' +
    '<div class="drawer-body"><div id="lines"></div><div id="cartFoot"></div></div></aside>' +
    '<div class="snack" id="snack" role="status" aria-live="polite" hidden></div>';

  /* Fill any element marked data-bind="email" | "phone" | "address" | "brand" with your details */
  function bindDetails(cat) {
    var s = cat.support;
    var map = { brand: cat.brand, email: s.email, phone: s.phone, address: s.addressLines.join(", "), freeAbove: BE.inr(cat.freeAbove) };
    Array.prototype.forEach.call(document.querySelectorAll("[data-bind]"), function (el) {
      var k = el.getAttribute("data-bind");
      if (map[k] != null) el.textContent = map[k];
      if (k === "email-link") { el.setAttribute("href", "mailto:" + s.email); el.textContent = s.email; }
      if (k === "phone-link") { el.setAttribute("href", "tel:" + s.phoneTel); el.textContent = s.phone; }
      if (k === "wa-link") { el.setAttribute("href", BE.wa(el.getAttribute("data-msg") || "")); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
      if (k === "map-link") { el.setAttribute("href", s.mapsUrl); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
    });
  }

  var CAT = null, lastFocus = null;

  function renderCart() {
    if (!CAT) return;
    var host = BE.$("lines"), foot = BE.$("cartFoot");
    var items = BE.cart.items(), subtotal = 0, n = 0, rows = "", problem = false;
    items.forEach(function (c) {
      var f = BE.findVariant(CAT, c.variantId);
      if (!f) { BE.cart.remove(c.variantId); return; }
      var v = f.variant, amt = v.price * c.qty;
      subtotal += amt; n += c.qty;
      if (!v.inStock) problem = true;
      rows +=
        '<div class="line" data-v="' + BE.esc(v.id) + '"><div><b>' + BE.esc(f.product.name) + '</b><div class="each">' + BE.esc(v.label) + " pack, " + BE.inr(v.price) + " each" +
        (v.inStock ? "" : ' <span class="oos">Out of stock</span>') + "</div></div>" +
        '<div class="amt">' + BE.inr(amt) + "</div>" +
        '<div class="stepper"><button type="button" data-act="minus" aria-label="One less">−</button><span aria-live="polite">' + c.qty + '</span><button type="button" data-act="plus" aria-label="One more">+</button></div>' +
        '<button type="button" class="remove" data-act="remove">Remove</button></div>';
    });
    if (!n) {
      host.innerHTML = '<p class="empty">Your cart is empty. Choose a pack and select Add to cart.</p>';
      foot.innerHTML = '<a class="btn outline-dark full" href="/shop">Browse coffee and pepper</a>';
    } else {
      host.innerHTML = rows;
      var left = CAT.freeAbove - subtotal;
      var ship = left > 0
        ? "Add " + BE.inr(left) + " more for free delivery."
        : "Your order gets free delivery.";
      foot.innerHTML =
        '<div class="total-row"><span>Subtotal</span><strong>' + BE.inr(subtotal) + "</strong></div>" +
        '<p class="small">' + ship + " Other delivery charges are shown at checkout.</p>" +
        (problem ? '<p class="error">Remove the out of stock item to continue.</p>' : "") +
        '<a class="btn cherry full' + (problem ? " disabled" : "") + '" href="' + (problem ? "#" : "/checkout.html") + '"' + (problem ? ' aria-disabled="true"' : "") + ">Go to checkout</a>";
    }
    var c = BE.$("cartCount");
    if (c) c.textContent = BE.cart.count();
  }

  BE.openCart = function () {
    lastFocus = document.activeElement;
    BE.$("overlay").hidden = false;
    var d = BE.$("drawer");
    d.classList.add("open"); d.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    BE.$("closeCart").focus();
  };
  function closeCart() {
    BE.$("overlay").hidden = true;
    var d = BE.$("drawer");
    d.classList.remove("open"); d.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Call once per page. Resolves with { cat, user }. */
  BE.init = function () {
    return Promise.all([BE.catalog(), BE.api("/api/auth/me")]).then(function (r) {
      CAT = r[0]; BE.cat = CAT; BE.user = r[1].user;
      /* Tidy a stale or tampered cart: unknown packs go, quantities become whole numbers from 1 to the limit. */
      var seen = {}, clean = [];
      cart.forEach(function (c) {
        var q = Math.min(CAT.maxQty || 20, Math.floor(Number(c.qty)));
        if (!BE.findVariant(CAT, c.variantId) || !(q > 0) || seen[c.variantId]) return;
        seen[c.variantId] = 1; clean.push({ variantId: c.variantId, qty: q });
      });
      if (JSON.stringify(clean) !== JSON.stringify(cart)) { cart = clean; try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (e) { /* ignore */ } }
      BE.$("siteHeader").innerHTML = headerHtml(CAT, BE.user);
      var f = BE.$("siteFooter"); if (f) f.innerHTML = footerHtml(CAT);
      document.body.insertAdjacentHTML("beforeend", drawerHtml);
      BE.$("openCart").addEventListener("click", BE.openCart);
      BE.$("closeCart").addEventListener("click", closeCart);
      BE.$("overlay").addEventListener("click", closeCart);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && BE.$("drawer").classList.contains("open")) closeCart(); });
      BE.$("lines").addEventListener("click", function (e) {
        var b = e.target.closest("button[data-act]"); if (!b) return;
        var id = b.closest(".line").getAttribute("data-v");
        var cur = BE.cart.items().filter(function (c) { return c.variantId === id; })[0];
        if (!cur) return;
        if (b.dataset.act === "plus") BE.cart.setQty(id, cur.qty + 1);
        else if (b.dataset.act === "minus") BE.cart.setQty(id, cur.qty - 1);
        else BE.cart.remove(id);
      });
      document.addEventListener("cart-change", renderCart);
      renderCart();
      bindDetails(CAT);
      var mb = BE.$("menuBtn"), menu = BE.$("mainMenu");
      mb.addEventListener("click", function () { var o = menu.classList.toggle("open"); mb.setAttribute("aria-expanded", o); mb.textContent = o ? "Close" : "Menu"; });
      menu.addEventListener("click", function (e) { if (e.target.tagName === "A") { menu.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); mb.textContent = "Menu"; } });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) { menu.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); mb.textContent = "Menu"; mb.focus(); } });
      return { cat: CAT, user: BE.user };
    }).catch(function () {
      var h = BE.$("siteHeader");
      if (h) h.innerHTML = '<div class="testbar">We could not load the shop. Check your connection and refresh the page.</div>';
      throw new Error("init failed");
    });
  };

  /* Address form used on the account and checkout pages. p is an id prefix. */
  BE.addressFields = function (p) {
    var opts = '<option value="">Choose your state</option>' + BE.cat.states.map(function (s) { return "<option>" + BE.esc(s) + "</option>"; }).join("");
    return (
      '<div class="two"><label for="' + p + 'Name">Full name<input id="' + p + 'Name" type="text" autocomplete="name"></label>' +
      '<label for="' + p + 'Phone">Mobile number<input id="' + p + 'Phone" type="tel" autocomplete="tel" inputmode="tel"></label></div>' +
      '<label for="' + p + 'Line1">House number and street<input id="' + p + 'Line1" type="text" autocomplete="address-line1"></label>' +
      '<label for="' + p + 'Line2">Area or landmark (optional)<input id="' + p + 'Line2" type="text" autocomplete="address-line2"></label>' +
      '<div class="two"><label for="' + p + 'City">City or town<input id="' + p + 'City" type="text" autocomplete="address-level2"></label>' +
      '<label for="' + p + 'Pin">Pincode<input id="' + p + 'Pin" type="text" inputmode="numeric" maxlength="6" autocomplete="postal-code"></label></div>' +
      '<label for="' + p + 'State">State<select id="' + p + 'State" autocomplete="address-level1">' + opts + "</select></label>"
    );
  };
  BE.readAddress = function (p) {
    return {
      name: BE.$(p + "Name").value, phone: BE.$(p + "Phone").value, line1: BE.$(p + "Line1").value, line2: BE.$(p + "Line2").value,
      city: BE.$(p + "City").value, pincode: BE.$(p + "Pin").value, state: BE.$(p + "State").value
    };
  };
  BE.addressText = function (a) {
    return [a.line1, a.line2, a.city + ", " + a.state + " " + a.pincode].filter(Boolean).join(", ");
  };

  BE.logout = function () {
    return BE.api("/api/auth/logout", { method: "POST" }).then(function () { location.href = "/"; });
  };
  /* Only allow redirects to pages on this site */
  BE.safeNext = function (n) { return typeof n === "string" && n.charAt(0) === "/" && n.charAt(1) !== "/" && n.indexOf("\\") < 0 ? n : "/account.html"; };
  BE.statusLabel = function (s) {
    return { pending_payment: "Waiting for payment", payment_failed: "Payment not completed", paid: "Paid, getting packed", packed: "Packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" }[s] || s;
  };
  BE.date = function (s) {
    if (!s) return "";
    var d = new Date(String(s).replace(" ", "T") + "Z");
    return isNaN(d) ? s : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
})();
