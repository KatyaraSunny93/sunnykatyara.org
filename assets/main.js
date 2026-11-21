(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");

  // header: solid after scrolling, phone menu
  function onScroll() { header.classList.toggle("scrolled", window.scrollY > 30); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // hero video: tall cut on phones, wide reel on desktop
  var hv = document.querySelector("video[data-wide]");
  if (hv) {
    var tall = window.innerHeight > window.innerWidth && hv.dataset.tall;
    hv.poster = tall ? hv.dataset.tallPoster : hv.dataset.widePoster;
    if (!reduce) { hv.src = tall ? hv.dataset.tall : hv.dataset.wide; hv.play().catch(function () {}); }
  }

  // typed rotating line
  var typed = document.querySelector(".typed span");
  if (typed && !reduce) {
    var lines = JSON.parse(typed.parentNode.dataset.lines), li = 0, ci = lines[0].length, del = true;
    (function tick() {
      var line = lines[li], wait = del ? 28 : 55;
      if (del) { ci--; if (ci === 0) { del = false; li = (li + 1) % lines.length; wait = 350; } }
      else { ci++; if (ci === lines[li].length) { del = true; wait = 2100; } }
      typed.textContent = lines[li].slice(0, ci);
      setTimeout(tick, wait);
    })();
  }

  // split headlines into words for the rise-in effect
  document.querySelectorAll("[data-split]").forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
            var o = document.createElement("span"), s = document.createElement("span");
            o.className = "w"; s.textContent = part; s.style.transitionDelay = (i++ * 0.055) + "s";
            o.appendChild(s); frag.appendChild(o);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { walk(n); }
      });
    })(el);
    el.classList.add("reveal-words");
  });

  // count-up numbers
  function countUp(el) {
    var m = el.textContent.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
    if (!m || reduce) return;
    var end = parseFloat(m[2]), dec = (m[2].split(".")[1] || "").length, t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / 1400, 1), v = end * (1 - Math.pow(1 - p, 3));
      el.textContent = m[1] + v.toFixed(dec) + m[3];
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var watch = document.querySelectorAll(".reveal, .reveal-words, [data-count]");
  if (!("IntersectionObserver" in window)) {
    watch.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        if (en.target.hasAttribute("data-count")) countUp(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    watch.forEach(function (el) { io.observe(el); });

    // looping clips play only while on screen
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !reduce) en.target.play().catch(function () {});
        else en.target.pause();
      });
    }, { threshold: 0.2 });
    document.querySelectorAll("video[data-loop]").forEach(function (v) { vio.observe(v); });
  }

  // client slider: moves one card at a time, pauses on hover / touch / focus and while off screen
  document.querySelectorAll("[data-slider]").forEach(function (sl) {
    var row = sl.querySelector(".slides");
    var cards = row.children, n = cards.length, hold = false, seen = false, idle;
    // endless row: a second copy of the cards follows the first, and the row quietly jumps back by one
    // set whenever it reaches the copy, so it never visibly ends or rewinds
    Array.prototype.slice.call(cards).forEach(function (c) {
      var k = c.cloneNode(true); k.setAttribute("aria-hidden", "true"); row.appendChild(k);
    });
    function step() { return n > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : row.clientWidth; }
    function index() { return Math.round(row.scrollLeft / step()); }
    function jump(by) { row.style.scrollBehavior = "auto"; row.scrollLeft += by * step(); row.style.scrollBehavior = ""; }
    function wrap() { if (index() >= n) jump(-n); }
    function go(dir) {
      wrap();
      if (dir < 0 && index() <= 0) jump(n);
      row.scrollTo({ left: (index() + dir) * step(), behavior: reduce ? "auto" : "smooth" });
    }
    row.addEventListener("scroll", function () { clearTimeout(idle); idle = setTimeout(wrap, 180); }, { passive: true });
    sl.querySelector("[data-prev]").addEventListener("click", function () { go(-1); });
    sl.querySelector("[data-next]").addEventListener("click", function () { go(1); });
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) { sl.addEventListener(ev, function () { hold = true; }, { passive: true }); });
    ["mouseleave", "focusout", "touchend"].forEach(function (ev) { sl.addEventListener(ev, function () { hold = false; }, { passive: true }); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }, { threshold: 0.4 }).observe(sl);
    } else { seen = true; }
    if (!reduce) setInterval(function () { if (seen && !hold && !document.hidden) go(1); }, 3200);
  });

  // booking form: sends the request by email, in the page
  var bf = document.querySelector("[data-bookform]");
  if (bf && window.fetch) {
    bf.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var status = bf.querySelector(".form-status"), btn = bf.querySelector("button[type=submit]");
      var data = {};
      new FormData(bf).forEach(function (v, k) { data[k] = String(v).trim(); });
      if (data._honey) return;
      data._subject = "Consultation request: " + data.Session + " (" + data.Name + ")";
      btn.disabled = true; status.className = "form-status"; status.textContent = "Sending ...";
      fetch(bf.dataset.endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data)
      }).then(function (r) { return r.json().then(function (j) { return r.ok && String(j.success) === "true"; }); })
        .then(function (ok) {
          if (!ok) throw new Error("not sent");
          var done = document.createElement("div");
          done.className = "form-done"; done.setAttribute("role", "status"); done.tabIndex = -1;
          done.innerHTML = "<h2>Request sent.</h2><p>Thank you. I will email you shortly to set up the meeting.</p>";
          bf.parentNode.replaceChild(done, bf); done.focus();
        })
        .catch(function () {
          btn.disabled = false; status.className = "form-status err";
          var body = ["Session", "Name", "email", "Company", "Preferred times", "Project"].map(function (k) {
            return (k === "email" ? "Email" : k) + ": " + (data[k] || "");
          }).join("\n");
          var a = document.createElement("a");
          a.href = "mailto:" + bf.dataset.mail + "?subject=" + encodeURIComponent(data._subject) + "&body=" + encodeURIComponent(body);
          a.textContent = "send it by email instead";
          status.textContent = "Your request could not be sent from this page. Please ";
          status.appendChild(a); status.appendChild(document.createTextNode("."));
        });
    });
  }

  // stagger tiles and cards
  document.querySelectorAll(".tiles, .clients, .blocks, .stats, .plans").forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty("--d", (i % 4) * 0.08 + "s"); });
  });
})();
