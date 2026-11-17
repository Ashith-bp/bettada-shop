(function () {
  "use strict";
  var $ = BE.$, esc = BE.esc, inr = BE.inr;
  var quote = null, saved = [], pickedId = "new";

  function contactHtml(user) {
    if (user) return '<p>Signed in as <b>' + esc(user.name) + "</b> (" + esc(user.email) + '). Order updates go to this email.</p>';
    return '<p class="notice">Have an account? <a href="/login.html?next=' + encodeURIComponent("/checkout.html") + '">Log in</a> to use your saved addresses and see your orders later. Or continue as a guest.</p>' +
      '<label for="coEmail">Email for order updates<input id="coEmail" type="email" autocomplete="email"></label>';
  }

  function getAddress() {
    if (pickedId !== "new") {
      var a = saved.filter(function (x) { return String(x.id) === pickedId; })[0];
      if (a) return { name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode };
    }
    return BE.readAddress("c");
  }

  function renderSaved() {
    var host = $("savedAddrs");
    if (!saved.length) { host.innerHTML = ""; $("addrForm").hidden = false; return; }
    host.innerHTML = saved.map(function (a) {
      return '<label class="addr"><input type="radio" name="addr" value="' + a.id + '"' + (String(a.id) === pickedId ? " checked" : "") + "><span><b>" + esc(a.name) + "</b>" + esc(BE.addressText(a)) + "<br>Mobile " + esc(a.phone) + "</span></label>";
    }).join("") + '<label class="addr"><input type="radio" name="addr" value="new"' + (pickedId === "new" ? " checked" : "") + "><span><b>Use a different address</b></span></label>";
    $("addrForm").hidden = pickedId !== "new";
    $("saveRow").hidden = pickedId !== "new";
  }

  function refreshQuote() {
    var a = getAddress();
    var items = BE.cart.items();
    if (!items.length) { location.reload(); return; }
    BE.api("/api/quote", { method: "POST", body: { items: items, state: a.state } }).then(function (q) {
      quote = q;
      $("sumLines").innerHTML = q.lines.map(function (l) {
        return '<div class="sum-line"><span>' + esc(l.name) + ", " + esc(l.label) + " x " + l.qty + "</span><span>" + inr(l.amount) + "</span></div>";
      }).join("");
      $("sumSub").textContent = inr(q.subtotal);
      if (q.shipping == null) {
        $("sumShip").textContent = "Choose your state";
        $("sumTotal").textContent = inr(q.subtotal);
        var left = q.freeAbove - q.subtotal;
        $("sumHint").textContent = left > 0 ? "Add " + inr(left) + " more for free delivery." : "Your order gets free delivery.";
      } else {
        $("sumShip").textContent = q.shipping ? inr(q.shipping) : "Free";
        $("sumTotal").textContent = inr(q.total);
        $("sumHint").textContent = q.shipping ? "Add " + inr(q.freeAbove - q.subtotal) + " more for free delivery." : "";
      }
    }).catch(function (e) { $("coError").textContent = e.message; });
  }

  BE.init().then(function (r) {
    var items = BE.cart.items();
    if (!items.length) { $("coEmpty").hidden = false; return; }
    $("coMain").hidden = false;
    $("contactBody").innerHTML = contactHtml(r.user);
    $("addrFields").innerHTML = BE.addressFields("c");
    if (r.user) { $("cName").value = r.user.name; $("cPhone").value = r.user.phone; }
    $("saveRow").hidden = !r.user;

    var go = r.user ? BE.api("/api/me/addresses").then(function (d) { saved = d.addresses; }) : Promise.resolve();
    go.then(function () {
      if (saved.length) pickedId = String((saved.filter(function (a) { return a.is_default; })[0] || saved[0]).id);
      renderSaved(); refreshQuote();
    });
    $("savedAddrs").addEventListener("change", function (e) { pickedId = e.target.value; renderSaved(); refreshQuote(); });
    $("cState").addEventListener("change", refreshQuote);
    document.addEventListener("cart-change", refreshQuote);
  }).catch(function () {});

  var paying = false;
  $("payBtn").addEventListener("click", function () {
    if (paying) return;
    $("coError").textContent = "";
    var body = { items: BE.cart.items(), address: getAddress(), notes: $("coNotes").value, saveAddress: !!($("saveAddr") && $("saveAddr").checked && pickedId === "new") };
    if (!BE.user) body.email = ($("coEmail") || {}).value;
    paying = true; $("payBtn").disabled = true; $("payBtn").textContent = "Starting payment...";
    BE.api("/api/orders", { method: "POST", body: body }).then(function (r) {
      try { sessionStorage.setItem("be-last-order", JSON.stringify({ id: r.orderId, t: r.token })); } catch (e) {}
      if (r.mode === "mock") { location.href = r.redirect; return; }
      if (typeof Cashfree !== "function") throw new Error("The payment window could not load. Check your connection and try again from your order page.");
      var cashfree = Cashfree({ mode: r.mode === "production" ? "production" : "sandbox" });
      return cashfree.checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: "_self" });
    }).catch(function (e) {
      $("coError").textContent = e.message;
      paying = false; $("payBtn").disabled = false; $("payBtn").textContent = "Pay securely";
    });
  });
})();
