(function () {
  "use strict";
  var esc = BE.esc, inr = BE.inr;
  BE.init().then(function (r) {
    var t = document.getElementById("shipTable");
    if (!t) return;
    var s = r.cat.shipping, rt = s.rates;
    var south = s.southStates.join(", "), remote = s.remoteStates.join(", ");
    var rows = [
      ["Orders of " + inr(s.freeAbove) + " or more, anywhere in India", "Free"],
      [s.homeState, inr(rt.home)],
      [south, inr(rt.south)],
      ["Rest of India", inr(rt.rest)],
      [remote, inr(rt.remote)]
    ];
    t.querySelector("tbody").innerHTML = rows.map(function (x) { return "<tr><td>" + esc(x[0]) + "</td><td>" + esc(x[1]) + "</td></tr>"; }).join("");
    document.getElementById("shipNote").textContent = "The charge applies once for every " + s.kgPerBlock + " kg of order weight, counting any part of " + s.kgPerBlock + " kg as a full block. For example, one 500 g pack to " + s.homeState + " costs " + inr(rt.home) + " when the order is below " + inr(s.freeAbove) + ".";
  }).catch(function () {});

  var form = document.getElementById("contactForm");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var $ = BE.$, btn = $("mBtn");
    $("mError").textContent = ""; $("mDone").hidden = true; btn.disabled = true;
    BE.api("/api/contact", { method: "POST", body: { name: $("mName").value, phone: $("mPhone").value, email: $("mEmail").value, message: $("mText").value } })
      .then(function () { $("mDone").hidden = false; form.reset(); })
      .catch(function (err) { $("mError").textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });
})();
