// Studio Fritz — site behavior: header multiply/collapse + carousels
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { a = a || 0; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, v)); }

  /* ---------------- stamp: pinned, but rests over the last carousel
     instead of floating down into the footer ----------------
     .scroll-hijack's own height is a huge scroll-runway (100vh + 1600px),
     not the visual carousel size -- resting at *its* bottom edge just
     landed the stamp at the footer boundary again (same bug as before,
     under a different name). What actually matters is the scrollY where
     .scroll-hijack-sticky (position:sticky, 100vh) releases -- that's
     when the wrapper's bottom edge reaches the viewport's bottom edge. */
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
      var releaseY = target.offsetTop + target.offsetHeight - window.innerHeight;
      var restTop = releaseY + pinnedTop - GAP;
      var shouldRest = window.scrollY >= releaseY - GAP;
      if (shouldRest && !resting) {
        resting = true;
        stamp.style.position = 'absolute';
        stamp.style.top = restTop + 'px';
      } else if (!shouldRest && resting) {
        resting = false;
        stamp.style.position = '';
        stamp.style.top = '';
      } else if (shouldRest) {
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
     (321:517) and "Homepage - Nav Bar Collapse" (218:69), then corrected
     again the same day after "it gets too busy when the multiplied STUDIO
     FRITZ overlays the paragraphs... i dont want overlapping of text ever":
     the wordmark multiplies to 3 solid rows ONLY as far as a live
     collision check against the hero paragraphs allows (never a fixed
     scroll-pixel guess -- see GAP_MIN below), then the SAME #heroNav
     (normally sitting under the two hero paragraphs -- there is only ever
     one nav, it is never duplicated) rises to dock just under it, and only
     once it has docked does the header hard-cut into its final collapsed
     state: rows fold back to one line, nav tucks up inside the bar's own
     bottom edge (part of the bar, not floating below it), and the
     background swaps to a solid crop of the Bluff Stools carousel photo
     (whatever's behind the header at that point) -- no fade, no video. */
  (function header() {
    // Row toggling is content-aware, not a tuned pixel constant: Eliza
    // ("it gets too busy when the multiplied STUDIO FRITZ overlays the
    // paragraphs... tldr i dont want translucency and overlapping of text
    // ever") needs this to be a structural guarantee, not a value that
    // happens to work at one viewport width. So instead of fixed
    // MULTIPLY_START/END scroll thresholds, each frame tentatively turns a
    // row on, measures the live gap between the header's bottom edge and
    // the hero paragraphs' top edge, and only keeps it on if a minimum
    // clearance survives. MULTIPLY_START still guards the very top of the
    // page (there's always technically "room" to triple at scrollY 0, but
    // it should still read as a progressive reveal, not instant).
    var MULTIPLY_START = 80;
    var GAP_MIN = 24; // required clearance (px) between tripled header and paragraphs
    var PIN_GAP = 12; // gap under the header while nav is still joining (pre-collapse)
    var NAV_INSET = 16; // how far the nav tucks up from the collapsed bar's bottom edge

    var header = document.getElementById('wmHeader');
    var nav = document.getElementById('heroNav');
    var heroEl = document.getElementById('hero');
    var heroContent = document.querySelector('.hero-content');
    var rows2 = document.querySelectorAll('.wm-row-2');
    var rows3 = document.querySelectorAll('.wm-row-3');
    if (!header || !nav || !heroContent) return;
    var ticking = false;
    var pinned = false;
    // scrollY at which the wordmark first successfully achieved full-triple
    // this downward pass -- once set, join is locked on (rows stay tripled)
    // until scrolling back above it, replacing the old fixed JOIN_AT.
    var joinAtY = null;

    function setRows(on2, on3) {
      rows2.forEach(function (el) { el.classList.toggle('is-on', on2); });
      rows3.forEach(function (el) { el.classList.toggle('is-on', on3); });
    }
    // Tentatively flips the rows, measures, and reports whether the gap
    // still holds. Safe to call more than once per frame: only the LAST
    // class state set before the browser paints ever becomes visible, and
    // this all runs synchronously within one rAF callback.
    function wouldFit(on2, on3) {
      setRows(on2, on3);
      var headerBottom = header.getBoundingClientRect().bottom;
      var contentTop = heroContent.getBoundingClientRect().top;
      return (contentTop - headerBottom) >= GAP_MIN;
    }

    function render() {
      ticking = false;
      var y = window.scrollY;
      var mobile = window.innerWidth <= 900;
      // collapse only once the hero has actually scrolled out from under the
      // header -- tying it to a fixed px guess made it hard-cut to solid
      // while still deep in the (transparent-over-video) hero, which read as
      // "still translucent." This also matches "grabs the image behind it":
      // the very next thing behind the header once the hero clears is the
      // first carousel row (Bluff Stools).
      var COLLAPSE_AT = heroEl ? Math.max(heroEl.offsetHeight - 40, 200) : 800;
      var collapsed = y >= COLLAPSE_AT;

      var row2On, row3On;
      if (collapsed) {
        row2On = false; row3On = false;
      } else if (joinAtY !== null && y >= joinAtY) {
        // already achieved full-triple on the way down -- hold it tripled
        // (this is the "meets the nav bar items" join phase) rather than
        // re-running the gate every frame, which would flicker the rows
        // back off the instant the shrinking gap dipped under GAP_MIN.
        row2On = true; row3On = true;
      } else {
        joinAtY = null;
        row2On = y > MULTIPLY_START ? wouldFit(true, false) : false;
        row3On = row2On && wouldFit(true, true);
        if (row3On) joinAtY = y;
      }
      setRows(row2On, row3On);

      header.classList.toggle('is-collapsed', collapsed);
      nav.classList.toggle('is-collapsed-nav', collapsed);
      header.style.setProperty('--hdr-bg-a', collapsed ? 1 : 0);

      if (mobile) {
        if (pinned) { nav.classList.remove('is-pinned'); nav.classList.remove('is-collapsed-nav'); nav.style.top = ''; pinned = false; }
        return;
      }

      var shouldJoin = collapsed || joinAtY !== null;
      if (shouldJoin) {
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
        var headerBottom = header.getBoundingClientRect().bottom;
        // pre-collapse: dock just under the (still tripled) header. Once
        // collapsed: tuck up INSIDE the bar's own bottom edge -- the bar's
        // padding-bottom (see .wordmark-header.is-collapsed in style.css)
        // is exactly what reserves the room for this, so the nav is
        // genuinely part of the bar rather than floating below it.
        nav.style.top = (collapsed
          ? headerBottom - nav.offsetHeight - NAV_INSET
          : headerBottom + PIN_GAP) + 'px';
      } else if (pinned) {
        nav.classList.remove('is-pinned');
        nav.classList.remove('is-collapsed-nav');
        nav.style.top = '';
        pinned = false;
      }
    }
    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    function onResize() { joinAtY = null; onScroll(); }
    if (reduce) { header.style.transition = 'none'; nav.style.transition = 'none'; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
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
