/* Page scripts for the storefront. Each page sets <body data-page="..."> and gets its handler below. */
(function () {
  "use strict";
  var $ = BE.$, esc = BE.esc, inr = BE.inr;
  var page = document.body.getAttribute("data-page");
  var MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  /* Months you harvest: 0 = January ... 11 = December. Edit to match your estate. */
  var HARVEST = [["Arabica", [10, 11, 0], "arabica"], ["Robusta", [0, 1, 2], "robusta"], ["Pepper", [11, 0, 1, 2], "pepper"]];

  function catCard(c) {
    var n = BE.productsIn(c.slug).length;
    return '<a class="cat-card" href="/collections/' + esc(c.slug) + '">' + BE.categoryMedia(c) +
      '<div class="cat-body"><h3>' + esc(c.name) + "</h3><p>" + esc(c.blurb) + '</p><span class="go">' + n + (n === 1 ? " product" : " products") + "</span></div></a>";
  }
  function crumbs(list) { var h = $("crumbs"); if (h) h.innerHTML = BE.crumbs(list); }
  function grid(el, list) {
    el.innerHTML = list.length ? list.map(BE.productCard).join("") : '<div class="empty-state"><b>Nothing here yet</b><a class="btn forest-btn small" href="/shop">Browse the shop</a></div>';
  }
  function descHtml(text) {
    var lines = String(text || "").split("\n"), intro = [], pts = [];
    lines.forEach(function (l) { if (l.indexOf("• ") === 0) pts.push(l.slice(2)); else if (l.trim()) intro.push(l); });
    return intro.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") +
      (pts.length ? '<ul class="desc-points">' + pts.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : "");
  }
  function setMeta(title) { document.title = title + " | " + BE.cat.brand; }
  function notFound(host, what) {
    host.innerHTML = '<div class="empty-state"><h2>We could not find that ' + what + '</h2><p>It may have moved. Try the shop.</p><a class="btn forest-btn" href="/shop">Go to the shop</a></div>';
  }

  var pages = {
    home: function (cat) {
      var tag = "<h2>Today's prices</h2>";
      cat.products.filter(function (p) { return p.mode === "buy"; }).forEach(function (p) {
        tag += '<div class="tag-group"><h3>' + esc(p.name) + "</h3>";
        p.variants.forEach(function (v) { tag += '<div class="tag-row"><span class="sz">' + esc(v.label) + '</span><span class="dots"></span><span class="pr">' + inr(v.price) + "</span></div>"; });
        tag += "</div>";
      });
      $("priceTag").innerHTML = tag + '<p class="tag-foot">Free delivery above ' + inr(cat.freeAbove) + "</p>";
      $("catGrid").innerHTML = cat.categories.map(catCard).join("");
      var best = ["arabica-coffee-powder", "robusta-coffee-powder", "black-pepper-whole"].map(BE.productBySlug).filter(Boolean);
      grid($("featured"), best);
      /* Banner photo: add public/assets/hero.jpg and it appears behind the headline. */
      var im = new Image();
      im.onload = function () {
        var h = document.querySelector(".hero"); if (!h) return;
        im.className = "hero-bg"; im.alt = ""; im.setAttribute("aria-hidden", "true");
        h.insertBefore(im, h.firstChild); h.classList.add("has-photo");
      };
      im.src = "/assets/hero.jpg";
      $("bulkList").innerHTML = cat.products.filter(function (p) { return p.mode !== "buy" && p.moqKg >= cat.bulkMinKg; }).map(function (p) {
        return '<li style="color:var(--ink)"><b>' + esc(p.name) + "</b><span>" + esc(p.tagline) + '</span><a href="/products/' + esc(p.slug) + '">Ask for a price</a></li>';
      }).join("");
    },

    shop: function (cat) {
      crumbs([["Home", "/"], ["Shop"]]);
      var qs = new URLSearchParams(location.search);
      var st = { category: qs.get("category") || "", type: qs.get("type") || "", q: qs.get("q") || "" };
      $("q").value = st.q;
      function pills(host, items, key) {
        host.innerHTML = items.map(function (i) { return '<button type="button" class="pill-btn" data-v="' + esc(i[0]) + '" aria-pressed="' + (st[key] === i[0]) + '">' + esc(i[1]) + "</button>"; }).join("");
        host.onclick = function (e) {
          var b = e.target.closest("button"); if (!b) return;
          st[key] = b.getAttribute("data-v"); paint();
        };
      }
      function paint() {
        pills($("fCat"), [["", "All"]].concat(cat.categories.map(function (c) { return [c.slug, c.name]; })), "category");
        pills($("fType"), [["", "Everything"], ["buy", "Buy online"], ["quote", "Bulk, price on request"]], "type");
        var q = st.q.trim().toLowerCase();
        var list = cat.products.filter(function (p) {
          return (!st.category || p.category === st.category) && (!st.type || p.mode === st.type) &&
            (!q || (p.name + " " + p.tagline + " " + p.tag + " " + p.description).toLowerCase().indexOf(q) > -1);
        });
        $("count").textContent = list.length + (list.length === 1 ? " product" : " products");
        if (list.length) grid($("grid"), list);
        else $("grid").innerHTML = '<div class="empty-state"><b>No products match</b><p>Try a different search or clear the filters.</p><button type="button" class="btn forest-btn small" id="clr">Clear filters</button></div>';
        var c = $("clr"); if (c) c.onclick = function () { st = { category: "", type: "", q: "" }; $("q").value = ""; paint(); };
        var u = new URLSearchParams(); Object.keys(st).forEach(function (k) { if (st[k]) u.set(k, st[k]); });
        try { history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : "")); } catch (e) { /* ignore */ }
      }
      $("q").addEventListener("input", function () { st.q = this.value; paint(); });
      paint();
    },

    collections: function (cat) {
      crumbs([["Home", "/"], ["Collections"]]);
      $("catGrid").innerHTML = cat.categories.map(catCard).join("");
    },

    collection: function (cat) {
      var slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
      var c = BE.category(slug);
      if (!c) { notFound($("grid"), "collection"); return; }
      setMeta(c.name);
      $("cTitle").textContent = c.name; $("cDesc").textContent = c.description;
      crumbs([["Home", "/"], ["Collections", "/collections"], [c.name]]);
      grid($("grid"), BE.productsIn(slug));
      $("catGrid").innerHTML = cat.categories.filter(function (x) { return x.slug !== slug; }).map(catCard).join("");
    },

    product: function (cat) {
      var slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
      var p = BE.productBySlug(slug), host = $("pd");
      if (!p) { notFound(host, "product"); return; }
      setMeta(p.name);
      var c = BE.category(p.category);
      crumbs([["Home", "/"], ["Shop", "/shop"]].concat(c ? [[c.name, "/collections/" + c.slug]] : []).concat([[p.name]]));
      var buy = p.mode === "buy", chosen = null, qty = 1, panel;
      if (buy) {
        var first = p.variants.filter(function (v) { return v.inStock; })[0];
        chosen = first ? first.id : null;
        panel = '<fieldset><legend>Pack size</legend><div class="sizes">' + p.variants.map(function (v) {
          return '<label class="size"><input type="radio" name="size" value="' + esc(v.id) + '"' + (v.id === chosen ? " checked" : "") + (v.inStock ? "" : " disabled") + '><span><b>' + esc(v.label) + "</b><em>" + inr(v.price) + "</em>" + (v.inStock ? "" : '<small class="oos">Out of stock</small>') + "</span></label>";
        }).join("") + '</div></fieldset><p class="perkg" id="perkg"></p>' +
          '<div class="buy-row"><div class="qty" role="group" aria-label="Quantity"><button type="button" id="qMinus" aria-label="Fewer">−</button><output id="qOut" aria-live="polite">1</output><button type="button" id="qPlus" aria-label="More">+</button></div>' +
          '<button type="button" class="btn cherry" id="addBtn"' + (chosen ? "" : " disabled") + ">" + (chosen ? "Add to cart" : "Out of stock") + '</button><button type="button" class="btn forest-btn" id="buyNow"' + (chosen ? "" : " disabled") + ">Buy now</button></div>" +
          '<p class="small">Free delivery above ' + inr(cat.freeAbove) + '. Need more than ' + cat.maxQty + ' packs? <a href="/bulk?product=' + encodeURIComponent(p.name) + '#enquire">Ask for a bulk price</a>.</p>';
      } else {
        var bulkLot = (p.moqKg || cat.bulkMinKg) >= cat.bulkMinKg;
        panel = '<div class="quote-box"><b>Price on request</b><p>' + (bulkLot ? "Bulk grade, supplied in lots of " + (p.moqKg || cat.bulkMinKg) + " kg and more to any city in India. Prices depend on quantity and season. Send us the quantity and we call you back with a price." : "This product is not listed for online sale yet. Send us the quantity you need and we will call you back with a price.") + '</p></div><div id="enqHost"></div>';
      }
      host.innerHTML = '<div class="pd-media">' + BE.mediaHtml(p, false) + '<span class="chip">' + esc(p.tag) + "</span></div>" +
        '<div class="pd-info"><h1>' + esc(p.name) + '</h1><p class="tagline" style="font-size:1.1rem">' + esc(p.tagline) + "</p>" +
        (buy ? '<div class="pd-price" id="pdPrice"></div>' : "") + panel +
        '<ul class="assure"><li>Grown and packed on our estate in Chikkamagalur</li><li>Sun-dried, export quality</li>' + (buy ? "<li>Secure online payment with UPI, cards and netbanking</li>" : "<li>Delivered across India</li>") + "</ul></div>";

      var specRows = [["Origin", "Chikkamagalur, Karnataka"], ["Processing", "Sun-dried"], ["Quality", "Export quality"], ["Category", c ? c.name : ""]];
      if (buy) specRows.push(["Pack sizes", p.variants.map(function (v) { return v.label; }).join(", ")], ["Storage", "Airtight container, cool and dry"]);
      else specRows.push(["Supply", "From " + (p.moqKg || cat.bulkMinKg) + " kg"], ["Specification", "Confirmed with your quotation"]);
      $("pdLower").innerHTML = '<div><h2>About this product</h2>' + descHtml(p.description) + '<p style="margin-top:14px">Questions about this product? <a data-bind="wa-link" data-msg="Hello ' + esc(cat.brand) + ', I have a question about ' + esc(p.name) + '." href="#">Ask us on WhatsApp</a> or <a href="/contact">contact us</a>.</p></div>' +
        '<div><h2>Details</h2><dl class="specs">' + specRows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl></div>";
      var wa = document.querySelector("#pdLower [data-bind=wa-link]");
      if (wa) { wa.setAttribute("href", BE.wa(wa.getAttribute("data-msg"))); wa.setAttribute("target", "_blank"); wa.setAttribute("rel", "noopener"); }

      if (buy) {
        var v0 = function () { return p.variants.filter(function (v) { return v.id === chosen; })[0]; };
        var paint = function () {
          var v = v0(); if (!v) return;
          $("pdPrice").innerHTML = inr(v.price) + "<small>" + esc(v.label) + "</small>";
          var half = p.variants.filter(function (x) { return x.grams === 500; })[0], kg = p.variants.filter(function (x) { return x.grams === 1000; })[0];
          var per = Math.round(v.price / (v.grams / 1000)), t = inr(per) + " per kg.";
          if (half && kg && v.id === kg.id && half.price * 2 > kg.price) t += " You save " + inr(half.price * 2 - kg.price) + " compared with two 500 g packs.";
          $("perkg").textContent = t;
          $("qOut").textContent = qty;
        };
        Array.prototype.forEach.call(host.querySelectorAll("input[name=size]"), function (r) { r.addEventListener("change", function () { chosen = r.value; paint(); }); });
        $("qMinus").onclick = function () { qty = Math.max(1, qty - 1); paint(); };
        $("qPlus").onclick = function () { qty = Math.min(cat.maxQty, qty + 1); paint(); };
        $("addBtn").onclick = function () { BE.cart.add(chosen, qty); BE.snack(p.name + ", " + v0().label + " x " + qty + " added", true); };
        $("buyNow").onclick = function () { BE.cart.add(chosen, qty); location.href = "/checkout.html"; };
        paint();
      } else {
        BE.enquiryForm($("enqHost"), { product: p.name, kg: p.moqKg || cat.bulkMinKg });
      }

      var rel = cat.products.filter(function (x) { return x.id !== p.id && x.category === p.category; });
      if (rel.length < 3) rel = rel.concat(cat.products.filter(function (x) { return x.id !== p.id && x.category !== p.category && x.mode === p.mode; }));
      rel = rel.slice(0, 4);
      if (rel.length) { $("relatedBand").hidden = false; grid($("related"), rel); }
    },

    bulk: function (cat) {
      crumbs([["Home", "/"], ["Bulk and export"]]);
      grid($("grid"), cat.products.filter(function (p) { return p.mode !== "buy" && p.moqKg >= cat.bulkMinKg; }));
      var pre = new URLSearchParams(location.search).get("product");
      BE.enquiryForm($("enqHost"), { full: true, pickProduct: true, product: pre || "Several products", kg: cat.bulkMinKg });
    },

    grades: function () { crumbs([["Home", "/"], ["Our grades"]]); },
    faq: function () { crumbs([["Home", "/"], ["Questions and answers"]]); },

    about: function () {
      crumbs([["Home", "/"], ["About"]]);
      var now = new Date().getMonth();
      var html = "<span></span>" + MONTHS.map(function (m) { return '<span class="m">' + m + "</span>"; }).join("");
      HARVEST.forEach(function (h) {
        html += '<span class="nm">' + esc(h[0]) + "</span>";
        for (var i = 0; i < 12; i++) html += '<span class="cell' + (h[1].indexOf(i) > -1 ? " on " + h[2] : "") + (i === now ? " now" : "") + '"></span>';
      });
      $("cal").innerHTML = html;
    }
  };

  BE.init().then(function (r) {
    Array.prototype.forEach.call(document.querySelectorAll(".freeAbove"), function (el) { el.textContent = inr(r.cat.freeAbove); });
    if (pages[page]) pages[page](r.cat);
  }).catch(function () {
    var m = $("main"); if (m && page) m.insertAdjacentHTML("afterbegin", '<div class="wrap" style="padding-block:40px"><p class="notice warn">We could not load this page. Check your connection and refresh.</p></div>');
  });
})();
