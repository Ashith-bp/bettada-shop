(function () {
  "use strict";
  var $ = BE.$;
  var params = new URLSearchParams(location.search);
  var next = BE.safeNext(params.get("next"));
  if (params.get("next")) $("nextNote").hidden = false;

  BE.init().then(function (r) {
    if (r.user) location.replace(next);
  });

  function show(which) {
    var login = which === "login";
    $("loginForm").hidden = !login; $("signupForm").hidden = login;
    $("tabLogin").setAttribute("aria-selected", login); $("tabSignup").setAttribute("aria-selected", !login);
  }
  $("tabLogin").addEventListener("click", function () { show("login"); });
  $("tabSignup").addEventListener("click", function () { show("signup"); });
  if (params.get("signup")) show("signup");

  function submit(form, btn, errId, path, body) {
    $(errId).textContent = ""; $(btn).disabled = true;
    BE.api(path, { method: "POST", body: body() })
      .then(function () { location.href = next; })
      .catch(function (e) { $(errId).textContent = e.message; $(btn).disabled = false; });
  }
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submit("loginForm", "lBtn", "lError", "/api/auth/login", function () { return { email: $("lEmail").value, password: $("lPass").value }; });
  });
  $("signupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submit("signupForm", "sBtn", "sError", "/api/auth/signup", function () {
      return { name: $("sName").value, email: $("sEmail").value, phone: $("sPhone").value, password: $("sPass").value };
    });
  });
})();
