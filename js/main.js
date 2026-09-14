// Studio Fritz — site behavior: header multiply/collapse + carousels
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { a = a || 0; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, v)); }

  /* ---------------- stamp: pinned, but rests above the footer instead of
     overflowing onto it ---------------- */
  (function stampFooterStop() {
    var stamp = document.querySelector('.stamp');
    var footer = document.querySelector('.site-footer');
    if (!stamp || !footer) return;
    var GAP = 40; // matches --sp-40, the section-gap rhythm used elsewhere
    var resting = false;
    var ticking = false;

    function render() {
      ticking = false;
      var stampH = stamp.getBoundingClientRect().height;
      var pinnedTop = window.innerHeight * 0.607; // matches .stamp's CSS top:60.7%
      var footerTop = footer.getBoundingClientRect().top;
      var shouldRest = footerTop <= pinnedTop + stampH + GAP;
      if (shouldRest && !resting) {
        resting = true;
        stamp.style.position = 'absolute';
        stamp.style.top = (footer.offsetTop - stampH - GAP) + 'px';
      } else if (!shouldRest && resting) {
        resting = false;
        stamp.style.position = '';
        stamp.style.top = '';
      } else if (shouldRest) {
        // footer height can change (e.g. viewport resize) -- keep it pinned
        // right above the footer's current position
        stamp.style.top = (footer.offsetTop - stampH - GAP) + 'px';
      }
    }
    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
  })();

  /* ---------------- header: hero -> multiply -> collapse ---------------- */
  (function header() {
    var HERO_END = 300, PEAK = 900, COLLAPSE_END = 1300;
    var header = document.getElementById('wmHeader');
    var rows2 = document.querySelectorAll('.wm-row-2');
    var rows3 = document.querySelectorAll('.wm-row-3');
    if (!header) return;
    var ticking = false;

    function render() {
      ticking = false;
      // stamp is static/always-visible now (see .stamp in style.css) — no
      // scroll-tied opacity here.
      var y = window.scrollY;
      var tm = clamp((y - HERO_END) / (PEAK - HERO_END));
      var tc = clamp((y - PEAK) / (COLLAPSE_END - PEAK));
      var row2Op = clamp(tm * 2) * (1 - tc);
      var row3Op = clamp(tm * 2 - 1) * (1 - tc);
      rows2.forEach(function (el) { el.style.opacity = row2Op; el.style.transform = 'translateY(' + (10 - row2Op * 10) + 'px)'; });
      rows3.forEach(function (el) { el.style.opacity = row3Op; el.style.transform = 'translateY(' + (10 - row3Op * 10) + 'px)'; });
      header.style.setProperty('--hdr-bg-a', tc);
      header.style.setProperty('--nav-a', tc);
    }
    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    if (reduce) header.style.transition = 'none';
    window.addEventListener('scroll', onScroll, { passive: true });
    render();
  })();

  /* ---------------- carousels: auto-scroll + drag ---------------- */
  var carousels = Array.prototype.slice.call(document.querySelectorAll('[data-carousel]'));
  var hijacked = [];

  carousels.forEach(function (el) {
    var track = el.querySelector('.carousel-track');
    if (!track) return;
    var isHijacked = el.hasAttribute('data-hijacked');
    var speed = 0.4; // px per frame, continuous drift
    var paused = false;
    var dragging = false, dragStartX = 0, dragStartScroll = 0, dragMoved = false;

    // duplicate tiles once for a seamless infinite loop (skip for hijacked:
    // that one is fully scroll-position-driven, finite, no loop needed)
    if (!isHijacked) {
      var originalHTML = track.innerHTML;
      track.innerHTML = originalHTML + originalHTML;
    }

    function autoStep() {
      if (!isHijacked && !paused && !dragging && !reduce) {
        track.scrollLeft += speed;
        var half = track.scrollWidth / 2;
        if (track.scrollLeft >= half) track.scrollLeft -= half;
      }
      requestAnimationFrame(autoStep);
    }
    if (!isHijacked) requestAnimationFrame(autoStep);

    // drag-to-scroll (mouse + touch, via pointer events)
    track.addEventListener('pointerdown', function (e) {
      dragging = true; dragMoved = false;
      dragStartX = e.clientX;
      dragStartScroll = track.scrollLeft;
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 3) dragMoved = true;
      track.scrollLeft = dragStartScroll - dx;
      if (!isHijacked) {
        var half = track.scrollWidth / 2;
        if (track.scrollLeft >= half) track.scrollLeft -= half;
        if (track.scrollLeft < 0) track.scrollLeft += half;
      }
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('dragging');
      // swallow the click that follows a real drag, so links don't fire accidentally
      if (dragMoved) {
        var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); track.removeEventListener('click', swallow, true); };
        track.addEventListener('click', swallow, true);
      }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', function (e) { if (dragging && e.buttons === 0) endDrag(e); });

    if (isHijacked) hijacked.push({ el: el, track: track, setPaused: function (p) { paused = p; } });
  });

  /* ---------------- scroll-hijack: the carousel immediately before the
     footer. A tall wrapper (--runway) holds a position:sticky pane; scroll
     progress through the wrapper maps 1:1 to the track's horizontal
     position. Auto-drift is already off for this carousel (isHijacked);
     drag still works at any time. ---------------- */
  var wrappers = Array.prototype.slice.call(document.querySelectorAll('.scroll-hijack'));
  if (wrappers.length && hijacked.length) {
    function renderHijack() {
      wrappers.forEach(function (wrap) {
        var inner = hijacked.filter(function (h) { return wrap.contains(h.el); })[0];
        if (!inner) return;
        var rect = wrap.getBoundingClientRect();
        var total = wrap.offsetHeight - window.innerHeight;
        if (total <= 0) return;
        var scrolledInto = -rect.top;
        var progress = clamp(scrolledInto / total);
        var max = inner.track.scrollWidth - inner.track.clientWidth;
        inner.track.scrollLeft = progress * max;
      });
    }
    var ticking2 = false;
    window.addEventListener('scroll', function () {
      if (!ticking2) { requestAnimationFrame(function () { ticking2 = false; renderHijack(); }); ticking2 = true; }
    }, { passive: true });
    window.addEventListener('resize', renderHijack);
    renderHijack();
  }
})();
