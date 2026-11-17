(function () {
  "use strict";
  var $ = BE.$, esc = BE.esc, inr = BE.inr;

  function tab(name) {
    ["Orders", "Addr", "Profile"].forEach(function (n) {
      var on = n === name;
      $("panel" + n).hidden = !on;
      $("tab" + n).setAttribute("aria-selected", on);
    });
  }
  ["Orders", "Addr", "Profile"].forEach(function (n) { $("tab" + n).addEventListener("click", function () { tab(n); }); });

  function orderCard(o) {
    var items = o.items.map(function (i) { return "<li><span>" + esc(i.name) + ", " + esc(i.label) + " x " + i.qty + "</span><span>" + inr(i.price * i.qty) + "</span></li>"; }).join("");
    return '<article class="order-card"><div class="order-top"><b>Order ' + esc(o.id) + '</b><span class="pill ' + esc(o.status) + '">' + esc(BE.statusLabel(o.status)) + "</span></div>" +
      '<p class="muted">Placed on ' + esc(BE.date(o.createdAt)) + "</p>" +
      '<ul class="order-items">' + items + "</ul>" +
      '<div class="sum-row"><span>Delivery</span><span>' + (o.shipping ? inr(o.shipping) : "Free") + "</span></div>" +
      '<div class="sum-row"><b>Total</b><b>' + inr(o.total) + "</b></div>" +
      (o.tracking ? '<p><b>Tracking:</b> ' + esc(o.tracking) + "</p>" : "") +
      '<p class="muted">Delivering to ' + esc(BE.addressText(o.address)) + "</p>" +
      '<div><a class="btn outline-dark small" href="/order.html?id=' + esc(o.id) + '">' + (o.status === "pending_payment" || o.status === "payment_failed" ? "Complete payment" : "View order") + "</a></div></article>";
  }
  function loadOrders() {
    BE.api("/api/me/orders").then(function (d) {
      $("ordersList").innerHTML = d.orders.length ? d.orders.map(orderCard).join("") :
        '<div class="card"><h2>No orders yet</h2><p>Your orders will show here once you place one.</p><a class="btn cherry" href="/shop">Shop coffee and pepper</a></div>';
    }).catch(function (e) { $("ordersList").innerHTML = '<p class="error">' + esc(e.message) + "</p>"; });
  }

  function loadAddrs() {
    BE.api("/api/me/addresses").then(function (d) {
      $("addrList").innerHTML = d.addresses.length ? d.addresses.map(function (a) {
        return '<div class="card"><div class="order-top"><b>' + esc(a.name) + "</b>" + (a.is_default ? '<span class="pill paid">Main address</span>' : "") + "</div>" +
          "<p>" + esc(BE.addressText(a)) + '</p><p class="muted">Mobile ' + esc(a.phone) + "</p>" +
          '<div class="actions">' + (a.is_default ? "" : '<button type="button" class="btn outline-dark small" data-def="' + a.id + '">Make main address</button>') +
          '<button type="button" class="btn outline-dark small" data-del="' + a.id + '">Delete</button></div></div>';
      }).join("") : '<p class="muted">You have no saved addresses yet.</p>';
    });
  }
  $("addrList").addEventListener("click", function (e) {
    var d = e.target.getAttribute("data-del"), m = e.target.getAttribute("data-def");
    if (d) BE.api("/api/me/addresses/" + d, { method: "DELETE" }).then(loadAddrs);
    if (m) BE.api("/api/me/addresses/" + m + "/default", { method: "POST" }).then(loadAddrs);
  });

  BE.init().then(function (r) {
    if (!r.user) { location.replace("/login.html?next=" + encodeURIComponent("/account.html")); return; }
    $("addrFields").innerHTML = BE.addressFields("a");
    $("aName").value = r.user.name; $("aPhone").value = r.user.phone;
    $("pName").value = r.user.name; $("pEmail").value = r.user.email; $("pPhone").value = r.user.phone;
    loadOrders(); loadAddrs();
    if (location.hash === "#addresses") tab("Addr");
  });

  $("addrForm").addEventListener("submit", function (e) {
    e.preventDefault();
    $("aError").textContent = ""; $("aBtn").disabled = true;
    var a = BE.readAddress("a"); a.isDefault = $("aDefault").checked;
    BE.api("/api/me/addresses", { method: "POST", body: a }).then(function () {
      ["Line1", "Line2", "City", "Pin"].forEach(function (f) { $("a" + f).value = ""; });
      $("aState").value = ""; $("aDefault").checked = false;
      loadAddrs();
    }).catch(function (err) { $("aError").textContent = err.message; }).then(function () { $("aBtn").disabled = false; });
  });
  $("profileForm").addEventListener("submit", function (e) {
    e.preventDefault(); $("pError").textContent = ""; $("pDone").hidden = true;
    BE.api("/api/me", { method: "PATCH", body: { name: $("pName").value, phone: $("pPhone").value } })
      .then(function () { $("pDone").hidden = false; })
      .catch(function (err) { $("pError").textContent = err.message; });
  });
  $("passForm").addEventListener("submit", function (e) {
    e.preventDefault(); $("cError").textContent = ""; $("cDone").hidden = true;
    BE.api("/api/me/password", { method: "POST", body: { current: $("cPass").value, next: $("nPass").value } })
      .then(function () { $("cDone").hidden = false; $("cPass").value = ""; $("nPass").value = ""; })
      .catch(function (err) { $("cError").textContent = err.message; });
  });
  $("logoutBtn").addEventListener("click", BE.logout);
})();
