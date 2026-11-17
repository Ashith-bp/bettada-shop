(function () {
  "use strict";
  var $ = BE.$, esc = BE.esc, inr = BE.inr;
  var p = new URLSearchParams(location.search);
  var id = p.get("id"), t = p.get("t") || "";
  var tries = 0;

  function render(o) {
    var head, note = "";
    if (o.status === "paid" || o.status === "packed" || o.status === "shipped" || o.status === "delivered") {
      head = "Thank you, your payment is confirmed";
      note = '<p class="notice good">We have your order and will pack it from the estate. Updates go to ' + esc(o.email) + ".</p>";
    } else if (o.status === "pending_payment") {
      head = "Confirming your payment";
      note = '<p class="notice">We are waiting for the bank to confirm your payment. This page updates by itself.</p>';
    } else if (o.status === "payment_failed") {
      head = "Your payment did not go through";
      note = '<p class="notice warn">No money was taken for this order, or it will be returned by your bank. You can try again below.</p>';
    } else if (o.status === "cancelled") {
      head = "This order was cancelled";
    } else head = "Your order";
    var items = o.items.map(function (i) { return "<li><span>" + esc(i.name) + ", " + esc(i.label) + " x " + i.qty + "</span><span>" + inr(i.price * i.qty) + "</span></li>"; }).join("");
    var canPay = o.status === "pending_payment" || o.status === "payment_failed";
    $("orderBody").innerHTML =
      '<div class="status-hero"><h1>' + esc(head) + '</h1><p><span class="pill ' + esc(o.status) + '">' + esc(BE.statusLabel(o.status)) + "</span> Order <b>" + esc(o.id) + "</b></p>" + note + "</div>" +
      '<div class="card" style="margin-top:24px"><ul class="order-items">' + items + "</ul>" +
      '<div class="sum-row"><span>Subtotal</span><span>' + inr(o.subtotal) + "</span></div>" +
      '<div class="sum-row"><span>Delivery</span><span>' + (o.shipping ? inr(o.shipping) : "Free") + "</span></div>" +
      '<div class="sum-total"><span>Total</span><span>' + inr(o.total) + "</span></div>" +
      '<p class="muted">Delivering to ' + esc(o.name) + ", " + esc(BE.addressText(o.address)) + ". Mobile " + esc(o.phone) + ".</p>" +
      (o.tracking ? "<p><b>Tracking:</b> " + esc(o.tracking) + "</p>" : "") +
      (canPay ? '<p class="error" id="payErr" role="alert"></p><button type="button" class="btn cherry" id="retry">Pay ' + inr(o.total) + "</button>" : "") +
      '<div><a class="btn outline-dark small" href="/">Back to the shop</a></div></div>';
    if (canPay) $("retry").addEventListener("click", retry);
  }

  function retry() {
    $("retry").disabled = true;
    BE.api("/api/orders/" + id + "/pay", { method: "POST", body: { t: t } }).then(function (r) {
      if (r.mode === "mock") { location.href = r.redirect; return; }
      var cashfree = Cashfree({ mode: r.mode === "production" ? "production" : "sandbox" });
      return cashfree.checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: "_self" });
    }).catch(function (e) { $("payErr").textContent = e.message; $("retry").disabled = false; });
  }

  function poll() {
    BE.api("/api/orders/" + id + "/verify", { method: "POST", body: { t: t } }).then(function (d) {
      render(d.order);
      if (d.order.status === "paid") BE.cart.clear();
      if (d.order.status === "pending_payment" && tries++ < 20) setTimeout(poll, 3000);
    }).catch(function (e) {
      $("orderBody").innerHTML = '<div class="card"><h2>We could not open this order</h2><p>' + esc(e.message) + '</p><p>If you are logged in, find your orders in <a href="/account.html">your account</a>.</p></div>';
    });
  }

  if (!id) { $("orderBody").innerHTML = '<div class="card"><h2>No order selected</h2><a class="btn cherry" href="/account.html">Go to your account</a></div>'; return; }
  var script = document.createElement("script");
  script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
  document.head.appendChild(script);
  BE.init().then(poll, poll);
})();
