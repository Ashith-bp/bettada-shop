(function () {
  "use strict";
  var $ = BE.$;
  var p = new URLSearchParams(location.search);
  var id = p.get("id"), t = p.get("t") || "";

  BE.init().then(function () {
    return BE.api("/api/orders/" + encodeURIComponent(id) + "?t=" + encodeURIComponent(t));
  }).then(function (d) {
    $("amt").textContent = BE.inr(d.order.total);
    $("mockOrder").textContent = "Order " + d.order.id;
  }).catch(function (e) { $("mError").textContent = e.message; });

  function finish(result) {
    $("okBtn").disabled = true; $("noBtn").disabled = true;
    BE.api("/api/mock/pay", { method: "POST", body: { t: t, result: result, id: id } }).then(function () {
      location.href = "/order.html?id=" + encodeURIComponent(id) + "&t=" + encodeURIComponent(t);
    }).catch(function (e) { $("mError").textContent = e.message; $("okBtn").disabled = false; $("noBtn").disabled = false; });
  }
  $("okBtn").addEventListener("click", function () { finish("success"); });
  $("noBtn").addEventListener("click", function () { finish("failed"); });
})();
