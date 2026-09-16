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
     Round 10 correction (2026-09-15), after Eliza's screenshots showed two
     remaining problems in the round-9 rebuild: "paragraph hides behind
     STUDIO FRITZ, it should just drop off and disappear as you scroll
     rather than go behind it" and "its only repeating twice, should
     repeat 3 times." Root cause of BOTH, found together:
     Round 9 only collision-gated row 3 (checked contentTop vs. a
     predicted header height before allowing the second triple-row) --
     row 2 had NO gate at all, just a raw scroll-distance threshold. So
     row 2 alone could already grow tall enough to reach the paragraphs
     with zero protection ("hides behind STUDIO FRITZ"), while row 3's
     gate, calibrated to never let the *header* touch the paragraphs, was
     incidentally strict enough that it rarely got the chance to turn on
     at all ("only repeating twice").
     Fixed by decoupling the two concerns instead of layering more gate
     conditions on the rows themselves: the paragraphs (.hero-intro) now
     fade on their OWN, smoothly, as the live gap between the header's
     predicted bottom edge and the paragraphs' top edge closes -- so they
     are already gone (opacity 0) well before the header could physically
     reach them, at any viewport size, with no fixed pixel guesswork
     ("drop off and disappear as you scroll," never "go behind"). With
     that protection in place, row 2/row 3 no longer need to be gated by
     paragraph proximity at all -- they're driven purely by scroll
     distance + stagger, so a full triple is reachable every time there's
     enough scroll room before the nav's own join trigger cuts it off
     ("should repeat 3 times"). Also, per "multiplication effect could be
     more gradual, 50% less fast" -- a further 50% slowdown on top of
     round 8's own 50% slowdown (.35s -> .525s -> .7875s), and the row
     stagger distance scaled up to match so row 2 still visibly finishes
     opening before row 3 starts ("one at a time"). */
  (function header() {
    /* ------------------------------------------------------------------
       The whole sequence is anchored to ONE measured number: dockDepth,
       the scroll depth at which the hero nav's own natural position lands
       exactly where it sits inside the collapsed bar. Docking THERE costs
       zero pixels -- the links are already on that pixel, so fixing them
       in place moves nothing. That removes the jump entirely, rather than
       trying to smooth it.

       Every earlier step is placed as a FRACTION of that runway, never as
       a hardcoded pixel count, so the pacing is identical on a 13" laptop
       and a 27" iMac -- the same class of bug as the old fixed tile cap
       and fixed carousel runway.

       The wordmark un-stacks on the way down as the mirror of how it
       stacked up (same .7875s wipe, reversed), finishing before the links
       arrive. So the three-deep wordmark is never hanging over them, and
       the bar closing around the nav is the single event in the sequence.
       ------------------------------------------------------------------ */
    var T_ROW2_ON = 0.08; // fractions of dockDepth
    var T_ROW3_ON = 0.30;
    var T_ROW3_OFF = 0.55; // un-stack well before the links reach the 3-row block
    var T_ROW2_OFF = 0.75;
    var PARA_FADE_ZONE = 160; // px of clearance over which the paragraphs fade -- scroll-linked, so it reads as driven rather than triggered
    var NAV_GAP = 33; // wordmark bottom -> nav top inside the bar. Figma 460:1999: nav y=131, padTop 8, wordmark line ~90
    var UNDOCK_MARGIN = 2; // float-safety only; the dock is zero-pixel, so it needs no real hysteresis
    var BG_FADE = 0.18; // fraction of dockDepth over which the orange ramps in.
      // Eliza: "should we do a fade in for the orange nav -- it does feel
      // drastic." It's a fade, but NOT a CSS transition: opacity is a
      // function of scroll position, so it's still the scroll driving it and
      // there's no second clock ticking alongside. It reaches exactly 1 on
      // the frame the nav docks, and runs backwards on the way up.

    var header = document.getElementById('wmHeader');
    var nav = document.getElementById('heroNav');
    var heroContent = document.querySelector('.hero-content');
    var heroIntro = document.querySelector('.hero-intro');
    var row1 = header ? header.querySelector('.wm-row-1') : null;
    var rows2 = document.querySelectorAll('.wm-row-2');
    var rows3 = document.querySelectorAll('.wm-row-3');
    if (!header || !nav || !heroContent || !row1 || !rows2.length || !rows3.length) return;

    var ticking = false;
    var pinned = false;
    var navFlowTop = null; // nav's natural top in DOCUMENT coords, valid only while unpinned
    var dockDepth = null;
    var lastTop = null;

    function padTop() { return parseFloat(getComputedStyle(header).paddingTop) || 0; }

    // Where the nav rests inside the bar. Depends only on the padding-top and
    // row 1, neither of which the collapse changes -- so this is the same
    // number before and after docking, which is what makes the dock free.
    function navRestTop() { return padTop() + row1.scrollHeight + NAV_GAP; }

    function barBottom() {
      var cs = getComputedStyle(header);
      return (parseFloat(cs.paddingTop) || 0) + row1.scrollHeight + (parseFloat(cs.paddingBottom) || 0);
    }

    // Intrinsic header height for a hypothetical row state, from each row's
    // own scrollHeight -- never a mid-animation getBoundingClientRect read.
    function predictedBottom(on2, on3) {
      var h = padTop() + row1.scrollHeight;
      if (on2) h += rows2[0].scrollHeight;
      if (on3) h += rows3[0].scrollHeight;
      return h + padTop();
    }

    function measure() {
      navFlowTop = nav.getBoundingClientRect().top + window.scrollY;
      dockDepth = Math.max(1, navFlowTop - navRestTop());
    }

    function setRows(on2, on3) {
      rows2.forEach(function (el) { el.classList.toggle('is-on', on2); });
      rows3.forEach(function (el) { el.classList.toggle('is-on', on3); });
    }

    function dock() {
      nav.classList.add('is-pinned', 'is-collapsed-nav');
      // .hero-content's z-index:2 makes it a stacking context, trapping the
      // nav below the header -- raise it only while docked.
      heroContent.classList.add('is-nav-pinned');
      lastTop = navRestTop();
      nav.style.top = lastTop + 'px';
      // the pre-footer carousel sticks below the bar, not under it
      document.documentElement.style.setProperty('--hdr-h', barBottom() + 'px');
      pinned = true;
    }

    function undock() {
      nav.classList.remove('is-pinned', 'is-collapsed-nav');
      heroContent.classList.remove('is-nav-pinned');
      nav.style.top = '';
      document.documentElement.style.setProperty('--hdr-h', '0px');
      pinned = false;
      lastTop = null;
      measure();
    }

    function render() {
      ticking = false;
      var y = window.scrollY;

      if (window.innerWidth <= 900) {
        setRows(false, false);
        if (heroIntro) heroIntro.style.opacity = '';
        if (pinned) undock();
        return;
      }

      if (!pinned) measure();

      if (!pinned && y >= dockDepth) dock();
      else if (pinned && y < dockDepth - UNDOCK_MARGIN) undock();

      // --- the orange, ramped on scroll position. .is-collapsed carries the
      // taller padding the docked nav needs, so it goes on at the START of
      // the ramp while the bar is still fully transparent -- the box grows
      // invisibly, and what fades in is already its final height.
      var bgA;
      if (pinned) {
        bgA = 1;
      } else {
        var fade = dockDepth * BG_FADE;
        bgA = clamp((y - (dockDepth - fade)) / fade, 0, 1);
      }
      header.style.setProperty('--hdr-bg-a', bgA);
      header.classList.toggle('is-collapsed', pinned || bgA > 0);

      // --- rows: a monotonic function of scroll depth, so scrolling back up
      // replays the same states in reverse and nothing can oscillate.
      var on2 = false, on3 = false;
      if (!pinned) {
        var t = y / dockDepth;
        if (t >= T_ROW2_ON && t < T_ROW2_OFF) on2 = true;
        if (t >= T_ROW3_ON && t < T_ROW3_OFF) on3 = true;
      }
      setRows(on2, on3);

      if (heroIntro) {
        if (pinned) {
          heroIntro.style.opacity = 0;
        } else {
          var gap = heroContent.getBoundingClientRect().top - predictedBottom(on2, on3);
          heroIntro.style.opacity = clamp(gap / PARA_FADE_ZONE, 0, 1);
        }
      }

      // while docked, `top` is only rewritten if the target genuinely moves
      if (pinned) {
        var target = navRestTop();
        if (lastTop === null || Math.abs(target - lastTop) > 0.5) {
          lastTop = target;
          nav.style.top = target + 'px';
        }
      }
    }

    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    function onResize() { if (pinned) undock(); measure(); onScroll(); }
    if (reduce) { header.style.transition = 'none'; nav.style.transition = 'none'; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    measure();
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
        var pane = wrap.querySelector('.scroll-hijack-sticky');
        var paneH = pane ? pane.offsetHeight : 0;
        var max = Math.max(0, inner.track.scrollWidth - inner.track.clientWidth);
        // Size the runway to the real horizontal distance, 1:1: scrolling
        // down a pixel moves the carousel across a pixel, and a viewport
        // wide enough to show everything costs no extra scroll at all.
        var wantH = paneH + max;
        if (Math.abs(wrap.offsetHeight - wantH) > 1) wrap.style.height = wantH + 'px';
        var total = wantH - paneH;
        if (total <= 0) { inner.track.scrollLeft = 0; return; }
        var scrolledInto = -rect.top;
        var progress = clamp(scrolledInto / total);
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
