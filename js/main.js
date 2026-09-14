// Studio Fritz — site behavior: header multiply/collapse + carousels
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { a = a || 0; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, v)); }

  /* ---------------- stamp: pinned, but rests over the last carousel
     instead of floating down into the footer ---------------- */
  (function stampFooterStop() {
    var stamp = document.querySelector('.stamp');
    var target = document.querySelector('.scroll-hijack');
    if (!stamp || !target) return;
    var GAP = 24;
    var resting = false;
    var ticking = false;

    function render() {
      ticking = false;
      var stampH = stamp.getBoundingClientRect().height;
      var pinnedTop = window.innerHeight * 0.607; // matches .stamp's CSS top:60.7%
      var targetBottom = target.getBoundingClientRect().bottom;
      var shouldRest = targetBottom <= pinnedTop + stampH + GAP;
      var restTop = target.offsetTop + target.offsetHeight - stampH - GAP;
      if (shouldRest && !resting) {
        resting = true;
        stamp.style.position = 'absolute';
        stamp.style.top = restTop + 'px';
      } else if (!shouldRest && resting) {
        resting = false;
        stamp.style.position = '';
        stamp.style.top = '';
      } else if (shouldRest) {
        // section height can change (e.g. viewport resize) -- keep it
        // pinned right at the current bottom edge of the carousel section
        stamp.style.top = restTop + 'px';
      }
    }
    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
  })();

  /* ---------------- header: multiply -> nav joins -> collapse ----------------
     Corrected 2026-09-14 per Eliza's walkthrough of "Homepage - Scroll"
     (321:517) and "Homepage - Nav Bar Collapse" (218:69): the wordmark
     multiplies to 3 solid rows, then the SAME #heroNav (normally sitting
     under the two hero paragraphs -- there is only ever one nav, it is
     never duplicated) rises to dock just under it, and only once it has
     docked does the header hard-cut into its final collapsed state: rows
     fold back to one line, nav settles at Figma's exact y (131px), and the
     background swaps to a solid crop of the Bluff Stools carousel photo
     (whatever's behind the header at that point) -- no fade, no video. */
  (function header() {
    var MULTIPLY_START = 80, MULTIPLY_END = 420;
    var JOIN_AT = MULTIPLY_END, COLLAPSE_AT = JOIN_AT + 200;
    var PIN_TOP = 131; // Figma 218:69 -- nav's y once docked under the 1-row header
    var GAP = 12;
    var header = document.getElementById('wmHeader');
    var nav = document.getElementById('heroNav');
    var rows2 = document.querySelectorAll('.wm-row-2');
    var rows3 = document.querySelectorAll('.wm-row-3');
    if (!header || !nav) return;
    var ticking = false;
    var pinned = false;

    function render() {
      ticking = false;
      var y = window.scrollY;
      var mobile = window.innerWidth <= 900;

      var mt = clamp((y - MULTIPLY_START) / (MULTIPLY_END - MULTIPLY_START));
      var collapsed = y >= COLLAPSE_AT;
      var row2On = !collapsed && mt > 0.02;
      var row3On = !collapsed && mt > 0.52;
      rows2.forEach(function (el) { el.classList.toggle('is-on', row2On); });
      rows3.forEach(function (el) { el.classList.toggle('is-on', row3On); });

      header.classList.toggle('is-collapsed', collapsed);
      header.style.setProperty('--hdr-bg-a', collapsed ? 1 : 0);

      if (mobile) {
        if (pinned) { nav.classList.remove('is-pinned'); nav.style.top = ''; pinned = false; }
        return;
      }

      if (y >= JOIN_AT) {
        if (!pinned) {
          // capture the nav's current on-screen position *before* switching
          // it to fixed, then force a reflow, so the CSS transition below
          // has a real "from" value instead of jumping straight to target
          var startTop = nav.getBoundingClientRect().top;
          nav.style.top = startTop + 'px';
          nav.classList.add('is-pinned');
          void nav.offsetHeight;
          pinned = true;
        }
        nav.style.top = (collapsed ? PIN_TOP : (header.getBoundingClientRect().bottom + GAP)) + 'px';
      } else if (pinned) {
        nav.classList.remove('is-pinned');
        nav.style.top = '';
        pinned = false;
      }
    }
    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    if (reduce) { header.style.transition = 'none'; nav.style.transition = 'none'; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
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
