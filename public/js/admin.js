(function () {
  "use strict";
  var $ = BE.$, esc = BE.esc, inr = BE.inr;
  var tabs = ["Orders", "Enq", "Msg", "Prices"];
  var ids = { Orders: "tOrders", Enq: "tEnq", Msg: "tMsg", Prices: "tPrices" };
  var panels = { Orders: "pOrders", Enq: "pEnq", Msg: "pMsg", Prices: "pPrices" };

  function tab(name) {
    tabs.forEach(function (n) {
      $(panels[n]).hidden = n !== name;
      $(ids[n]).setAttribute("aria-selected", n === name);
    });
    if (name === "Enq") loadEnq();
    if (name === "Msg") loadMsg();
    if (name === "Prices") loadPrices();
  }
  tabs.forEach(function (n) { $(ids[n]).addEventListener("click", function () { tab(n); }); });

  function loadStats() {
    BE.api("/api/admin/orders").then(function (d) {
      var paid = d.orders.filter(function (o) { return ["paid", "packed", "shipped", "delivered"].indexOf(o.status) > -1; });
      var toPack = d.orders.filter(function (o) { return o.status === "paid"; }).length;
      var revenue = paid.reduce(function (n, o) { return n + o.total; }, 0);
      $("stats").innerHTML =
        '<div class="stat"><b>' + toPack + "</b>Paid, to pack</div>" +
        '<div class="stat"><b>' + paid.length + "</b>Paid orders</div>" +
        '<div class="stat"><b>' + inr(revenue) + "</b>Paid total</div>";
    });
  }

  function orderCard(o) {
    var items = o.items.map(function (i) { return "<li><span>" + esc(i.name) + ", " + esc(i.label) + " x " + i.qty + "</span><span>" + inr(i.price * i.qty) + "</span></li>"; }).join("");
    var canUpdate = ["paid", "packed", "shipped", "delivered"].indexOf(o.status) > -1;
    var opts = ["packed", "shipped", "delivered", "cancelled"].map(function (s) {
      return '<option value="' + s + '"' + (o.status === s ? " selected" : "") + ">" + BE.statusLabel(s) + "</option>";
    }).join("");
    return '<article class="order-card" data-id="' + esc(o.id) + '"><div class="order-top"><b>' + esc(o.id) + '</b><span class="pill ' + esc(o.status) + '">' + esc(BE.statusLabel(o.status)) + "</span></div>" +
      '<p class="muted">' + esc(BE.date(o.createdAt)) + " · " + esc(o.name) + " · " + esc(o.phone) + " · " + esc(o.email) + "</p>" +
      "<p>" + esc(BE.addressText(o.address)) + "</p>" +
      '<ul class="order-items">' + items + "</ul>" +
      '<div class="sum-row"><span>Delivery</span><span>' + (o.shipping ? inr(o.shipping) : "Free") + '</span></div><div class="sum-row"><b>Total</b><b>' + inr(o.total) + "</b></div>" +
      (canUpdate || o.status === "pending_payment" || o.status === "payment_failed" ? '<div class="admin-controls">' +
        '<label>Status<select data-f="status">' + opts + "</select></label>" +
        '<label class="grow">Tracking number or courier note<input type="text" data-f="tracking" maxlength="120" value="' + esc(o.tracking) + '"></label>' +
        '<button type="button" class="btn forest-btn small" data-save>Save</button></div>' +
        '<p class="error" data-err role="alert"></p>' : "") + "</article>";
  }
  function loadOrders() {
    var st = $("fStatus").value;
    BE.api("/api/admin/orders" + (st ? "?status=" + encodeURIComponent(st) : "")).then(function (d) {
      $("adminOrders").innerHTML = d.orders.length ? d.orders.map(orderCard).join("") : '<p class="muted">No orders here yet.</p>';
    });
  }
  $("fStatus").addEventListener("change", loadOrders);
  $("adminOrders").addEventListener("click", function (e) {
    if (!e.target.hasAttribute("data-save")) return;
    var card = e.target.closest(".order-card");
    var err = card.querySelector("[data-err]"); err.textContent = "";
    BE.api("/api/admin/orders/" + card.getAttribute("data-id"), {
      method: "PATCH",
      body: { status: card.querySelector("[data-f=status]").value, tracking: card.querySelector("[data-f=tracking]").value }
    }).then(function () { loadOrders(); loadStats(); }).catch(function (x) { err.textContent = x.message; });
  });

  function loadEnq() {
    BE.api("/api/admin/enquiries").then(function (d) {
      if (!d.enquiries.length) { $("enqTable").innerHTML = '<p class="muted">No bulk enquiries yet.</p>'; return; }
      $("enqTable").innerHTML = "<table><thead><tr><th>Date</th><th>Name</th><th>Contact</th><th>Wants</th><th>City and state</th><th>Business</th><th>Notes</th><th>Status</th></tr></thead><tbody>" +
        d.enquiries.map(function (q) {
          var o = ["new", "contacted", "closed"].map(function (s) { return '<option value="' + s + '"' + (q.status === s ? " selected" : "") + ">" + s.charAt(0).toUpperCase() + s.slice(1) + "</option>"; }).join("");
          return "<tr><td>" + esc(BE.date(q.created_at)) + "</td><td>" + esc(q.name) + "</td><td>" + esc(q.phone) + (q.email ? "<br>" + esc(q.email) : "") + "</td><td>" + esc(q.product) + ", " + q.kg + " kg</td><td>" + esc(q.city) + (q.state ? ", " + esc(q.state) : "") + "</td><td>" + esc(q.business_type) + (q.gstin ? "<br>GST " + esc(q.gstin) : "") + "</td><td>" + esc(q.notes) + '</td><td><select data-enq="' + q.id + '" aria-label="Status">' + o + "</select></td></tr>";
        }).join("") + "</tbody></table>";
    });
  }
  $("enqTable").addEventListener("change", function (e) {
    var id = e.target.getAttribute("data-enq");
    if (id) BE.api("/api/admin/enquiries/" + id, { method: "PATCH", body: { status: e.target.value } });
  });

  function loadMsg() {
    BE.api("/api/admin/messages").then(function (d) {
      if (!d.messages.length) { $("msgTable").innerHTML = '<p class="muted">No messages yet.</p>'; return; }
      $("msgTable").innerHTML = "<table><thead><tr><th>Date</th><th>Name</th><th>Contact</th><th>Message</th><th>Status</th></tr></thead><tbody>" +
        d.messages.map(function (m) {
          var o = ["new", "done"].map(function (s) { return '<option value="' + s + '"' + (m.status === s ? " selected" : "") + ">" + (s === "new" ? "New" : "Done") + "</option>"; }).join("");
          return "<tr><td>" + esc(BE.date(m.created_at)) + "</td><td>" + esc(m.name) + "</td><td>" + esc(m.phone) + (m.email ? "<br>" + esc(m.email) : "") + "</td><td>" + esc(m.message) + '</td><td><select data-msg="' + m.id + '" aria-label="Status">' + o + "</select></td></tr>";
        }).join("") + "</tbody></table>";
    });
  }
  $("msgTable").addEventListener("change", function (e) {
    var id = e.target.getAttribute("data-msg");
    if (id) BE.api("/api/admin/messages/" + id, { method: "PATCH", body: { status: e.target.value } });
  });

  function loadPrices() {
    BE.api("/api/admin/products").then(function (d) {
      var html = '<p class="small" style="margin-bottom:14px">Products with no pack size show "Price on request" and an enquiry form. Add a pack size and price and the product becomes available to buy online.</p>';
      d.products.forEach(function (p) {
        var rows = p.variants.map(function (v) {
          return '<tr data-v="' + esc(v.id) + '"><td>' + esc(v.label) + '</td><td><input type="number" min="1" max="1000000" value="' + v.price + '" aria-label="Price in rupees"></td>' +
            '<td><label class="check"><input type="checkbox"' + (v.inStock ? " checked" : "") + '> In stock</label></td><td><button type="button" class="btn forest-btn small" data-savev>Save</button> <button type="button" class="btn outline-dark small" data-delv>Remove</button> <span class="small" data-msg role="status"></span></td></tr>';
        }).join("");
        html += '<section class="card" style="margin-bottom:18px" data-p="' + esc(p.id) + '"><h3>' + esc(p.name) + ' <span class="small">' + (p.mode === "buy" ? "Sold online" : "Price on request") + "</span></h3>" +
          (rows ? '<div class="table-scroll"><table><thead><tr><th>Pack</th><th>Price (₹)</th><th>Stock</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : '<p class="muted">No pack sizes yet.</p>') +
          '<div class="admin-controls" style="margin-top:12px"><label>New pack label<input type="text" data-n="label" maxlength="30" placeholder="e.g. 5 kg"></label>' +
          '<label>Weight in grams<input type="number" data-n="grams" min="50" placeholder="5000"></label><label>Price (₹)<input type="number" data-n="price" min="1" placeholder="7000"></label>' +
          '<button type="button" class="btn cherry small" data-addv>Add pack size</button></div><p class="small" data-addmsg role="status"></p></section>';
      });
      $("priceTable").innerHTML = html;
    });
  }
  $("priceTable").addEventListener("click", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-savev")) {
      var tr = t.closest("tr"), msg = tr.querySelector("[data-msg]");
      BE.api("/api/admin/variants/" + tr.getAttribute("data-v"), { method: "PATCH", body: { price: tr.querySelector("input[type=number]").value, inStock: tr.querySelector("input[type=checkbox]").checked } })
        .then(function () { msg.textContent = "Saved."; }).catch(function (x) { msg.textContent = x.message; });
    } else if (t.hasAttribute("data-delv")) {
      if (t.getAttribute("data-sure") !== "1") { t.setAttribute("data-sure", "1"); t.textContent = "Click again to remove"; return; }
      BE.api("/api/admin/variants/" + t.closest("tr").getAttribute("data-v"), { method: "DELETE" }).then(loadPrices);
    } else if (t.hasAttribute("data-addv")) {
      var sec = t.closest("section"), m = sec.querySelector("[data-addmsg]");
      function f(k) { return sec.querySelector("[data-n=" + k + "]").value; }
      BE.api("/api/admin/variants", { method: "POST", body: { productId: sec.getAttribute("data-p"), label: f("label"), grams: f("grams"), price: f("price") } })
        .then(loadPrices).catch(function (x) { m.textContent = x.message; });
    }
  });

  BE.init().then(function (r) {
    if (!r.user) { location.replace("/login.html?next=" + encodeURIComponent("/admin.html")); return; }
    if (!r.user.isAdmin) { $("adminGate").innerHTML = '<div class="card"><h2>This page is for the store owner</h2><p>You are logged in as ' + esc(r.user.email) + ", which is not the owner account.</p></div>"; return; }
    $("adminGate").hidden = true; $("adminApp").hidden = false;
    loadStats(); loadOrders();
  });
})();
