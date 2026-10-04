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
      // Runs on mobile too now: Eliza wants the stamp static and persisting
      // as you scroll, same as desktop, so it needs the same park-above-the-
      // footer pass. Its CSS top stays 60.7%, which is what pinnedTop below
      // assumes.
      var stampH = stamp.getBoundingClientRect().height;
      var pinnedTop = window.innerHeight * 0.55; // matches .stamp's CSS top:55%
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

  /* ---------------- page stamp: same pin/rest treatment, generalized ----------------
     Contact/Custom/Showroom/Trade/FAQ each carry their own .page-stamp
     (Figma-tuned position, orange asset) instead of the homepage's shared
     .stamp -- but Eliza wants the same behavior: "it should float as the
     contents scroll under it, stopping above the last carousel (always)."
     Desktop only -- mobile already has its own deliberate static/hidden
     .page-stamp rules per page (Figma's own mobile frames), untouched here.

     Unlike .stamp above (always fixed via a CSS percentage), .page-stamp's
     pinned position isn't a clean percentage -- it's measured once from
     the stylesheet's own absolute top/left (whatever those numbers are per
     page), so this keeps working unchanged if any of them move. The target
     to stop above is .scroll-hijack when a page has one (Contact/Trade
     wrap their carousel in the same scroll-hijack runway as the homepage)
     or the plain .carousel otherwise (Custom/Showroom/FAQ) -- either way,
     what matters is just where that section BEGINS, not its height, so
     both cases use the same formula. */
  (function pageStampFloat() {
    // Eliza (15th pass): "orange stamp [on catalogue] should float over
    // the page contents, but then staying static before footer and not
    // rolling up overlapping with nav bar -- same as stamp on homepage."
    // .catalogue-stamp was never wired into this at all (just a plain
    // position:absolute sitting in normal flow, no float/pin). Folded in
    // here rather than duplicated: the function only ever reads the
    // stamp's OWN existing CSS position (via getBoundingClientRect) and
    // overrides it with inline fixed/absolute, so it doesn't care which
    // class supplied that position -- .catalogue-stamp's own left/top/
    // width/opacity rules in style.css are untouched and still apply.
    var stamp = document.querySelector('.page-stamp, .catalogue-stamp');
    var included = stamp && document.body.matches(
      '.page-contact, .page-custom, .page-showroom, .page-trade, .page-faq, .page-catalogue'
    );
    if (!included) return;
    var target = document.querySelector('.scroll-hijack') || document.querySelector('.carousel');
    if (!target) return;
    var GAP = 24;
    var pinnedTop = null;
    var pinnedLeft = null;

    function desktop() { return window.innerWidth > 1152; }

    function measure() {
      if (!desktop()) return;
      // Clear any inline override first so this reads the stylesheet's own
      // absolute position, not a stale fixed/absolute value from before.
      stamp.style.position = '';
      stamp.style.top = '';
      stamp.style.left = '';
      var r = stamp.getBoundingClientRect();
      pinnedTop = r.top + window.scrollY; // scroll-invariant: viewport Y at scrollY 0
      /* GLOBAL RULE (Eliza, 2026-10-03): the stamp starts ABOVE the fold.
         If its stylesheet position would put it low on a short window, pin
         it so it is 100% visible at load with a margin below it of ~10% of its height. */
      pinnedTop = Math.min(pinnedTop, Math.max(200, window.innerHeight - r.height * 1.1));
      pinnedLeft = r.left;
    }

    function render() {
      if (!desktop()) {
        stamp.style.position = ''; stamp.style.top = ''; stamp.style.left = '';
        return;
      }
      if (pinnedTop === null) measure();
      var stampH = stamp.getBoundingClientRect().height || stamp.offsetHeight;
      var releaseScrollY = target.offsetTop - pinnedTop - stampH - GAP;
      if (window.scrollY >= releaseScrollY) {
        stamp.style.position = 'absolute';
        stamp.style.top = (target.offsetTop - stampH - GAP) + 'px';
        // Eliza (2026-10-02): "stamp is in wrong spot on catalogue and
        // shifts midway." Root cause: .catalogue-stamp's own containing
        // block (.catalogue-section) is centered with a max-width cap, so
        // its left edge isn't the viewport's left edge on any screen
        // wider than that cap. `top` already got this right -- pinnedTop
        // is captured from the element's OWN rendered position before
        // switching to fixed, so vertical stays continuous -- but `left`
        // was never touched at all, so while pinned/fixed the stylesheet's
        // left:847u resolved against the viewport (uncapped, flush left)
        // instead of the centered section, then visibly snapped sideways
        // by the cap's own side margin the moment it released back into
        // absolute mode. Clearing the inline override here lets the
        // stylesheet's own left:847u (correct for .catalogue-section's
        // frame) take over again, same pattern as top.
        stamp.style.left = '';
      } else {
        stamp.style.position = 'fixed';
        stamp.style.top = pinnedTop + 'px';
        stamp.style.left = pinnedLeft + 'px';
      }
    }

    var ticking = false;
    function onScroll() { if (!ticking) { requestAnimationFrame(function () { ticking = false; render(); }); ticking = true; } }
    function onResize() { pinnedTop = null; pinnedLeft = null; measure(); render(); }

    measure();
    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
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
    // scroll-cue hysteresis: Eliza wants it gone early on the way down (well
    // before row2 even opens at T_ROW2_ON) and only back once you're nearly
    // at the top on the way up -- two thresholds, not one, so the state
    // holds steady between them instead of flickering right at a single line.
    var CUE_HIDE_T = 0.05; // fraction of dockDepth scrolled -> cue hides
    var CUE_SHOW_T = 0.015; // must scroll back above this (nearer the top) to show again
    var PARA_FADE_ZONE = 160; // px of clearance over which the paragraphs fade -- scroll-linked, so it reads as driven rather than triggered
    var NAV_GAP_U = 33; // wordmark bottom -> nav top inside the bar, in FIGMA px. Figma 460:1999: nav y=131, padTop 8, wordmark line ~90
    var UNDOCK_MARGIN = 2; // float-safety only; the dock is zero-pixel, so it needs no real hysteresis
    var MOBILE_BG_FADE = 0.12; // fraction of viewport height; ~100px at 843
    var lastMobileA = -1, lastMobileH = -1;
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
    var scrollCue = document.querySelector('.scroll-cue');
    var cueVisible = true;
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
    // The page now scales through --u (1 Figma px, see :root in style.css),
    // so a raw 33 here would stop matching the CSS the moment the viewport
    // left 1440. Rather than duplicate the clamp formula in JS -- two
    // sources of truth for one number is exactly the drift this change is
    // meant to end -- derive the scale from a length the cascade has
    // already resolved: the header's padding-top is var(--sp-8), i.e. 8u.
    // (getComputedStyle on the custom property itself is no use; it hands
    // back the unresolved "calc(...)" token.)
    function scale() { return (parseFloat(getComputedStyle(header).paddingTop) || 8) / 8; }
    function navRestTop() { return padTop() + row1.scrollHeight + NAV_GAP_U * scale(); }

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
      document.documentElement.style.setProperty('--hdr-h', Math.floor(barBottom()) + 'px');
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

      if (window.innerWidth <= 1152) {
        /* Mobile has no multiply and nothing to dock: Figma's three scroll
           frames (160:104 / 278:1285 / 278:1232) draw the bar identically
           every time, so it never changes size. All that happens on scroll
           is the orange ramping in -- and because it rides the same
           --hdr-bg-a driver desktop uses, FRITZ and the logomark cross-fade
           with it for free rather than needing a rule of their own. */
        setRows(false, false);
        if (heroIntro) heroIntro.style.opacity = '';
        if (scrollCue && !cueVisible) { cueVisible = true; scrollCue.classList.remove('is-hidden'); }
        if (pinned) undock();
        /* Only write when something actually changed. This used to set
           --hdr-bg-a, toggle a class and read header.offsetHeight on EVERY
           scroll event -- a style write followed by a layout read, sixty
           times a second, which is the classic layout-thrash recipe. Past
           the ramp all three values are constant, so the common case is now
           no DOM work at all. */
        var mFade = window.innerHeight * MOBILE_BG_FADE;
        var mA = clamp(y / mFade, 0, 1);
        if (mA !== lastMobileA) {
          lastMobileA = mA;
          header.style.setProperty('--hdr-bg-a', mA);
          header.classList.toggle('is-collapsed', mA > 0);
        }
        var mh = header.offsetHeight;
        if (mh !== lastMobileH) {
          lastMobileH = mh;
          document.documentElement.style.setProperty('--hdr-h', mh + 'px');
        }
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

      if (scrollCue) {
        var cueT = pinned ? 1 : (y / dockDepth);
        if (cueVisible && cueT > CUE_HIDE_T) cueVisible = false;
        else if (!cueVisible && cueT < CUE_SHOW_T) cueVisible = true;
        scrollCue.classList.toggle('is-hidden', !cueVisible);
      }

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
    /* Continuous drift, px per frame. Mobile runs 30% slower per Eliza --
       the tiles there are a third the height, so the same absolute speed
       reads much faster against them. Desktop's is untouched. */
    var SPEED = 0.4, SPEED_M = 0.16;   // mobile: -30%, -50%, then +15%
    function speed() { return window.innerWidth <= 1152 ? SPEED_M : SPEED; }
    var paused = false;
    var dragging = false, dragStartX = 0, dragStartScroll = 0, dragMoved = false;

    // Duplicate the tiles once for a seamless infinite loop -- now for the
    // hijacked carousel too. It used to be excluded because it was purely
    // scroll-position-driven and finite; it now drifts like the others
    // whenever the scroll isn't actively driving it, so it needs the loop.
    var originalHTML = track.innerHTML;
    track.innerHTML = originalHTML + originalHTML;

    // One set's width. Everything positional below works in this space and
    // wraps, so drift, drag and the scroll-hijack can hand off to each
    // other at any point without a jump.
    function loopWidth() { return track.scrollWidth / 2; }
    function setLeft(l) {
      var w = loopWidth();
      if (w > 0) { l = l % w; if (l < 0) l += w; }
      track.scrollLeft = l;
    }

    /* The drift accumulates its own sub-pixel remainder instead of doing
       scrollLeft = scrollLeft + speed each frame.

       That older form stopped moving entirely once mobile went to 0.14
       px/frame ("the carousel auto-scrolling is gone now? for both
       carousels"). Reading scrollLeft back gives a value the engine may have
       rounded, so adding a fraction and writing it lands on the same pixel,
       and the next frame reads that same pixel again -- the remainder is
       thrown away every frame and nothing ever accumulates. It survived 0.4
       by luck, not by design; any speed below ~0.5 was going to die.

       Keeping the remainder in JS and only writing whole pixels makes any
       speed work, however slow. At 0.14 that is a 1px step about every 7
       frames, which at this pace reads as continuous. */
    /* Sub-pixel drift, in two parts.

       scrollLeft can only land on whole pixels at DPR 1, so the previous
       version stepped 1px roughly every 7 frames -- about 9 steps a second,
       which is exactly the "choppiness" Eliza saw. Slowing the carousel
       down made it worse, because fewer steps per second is what choppy
       IS. There is no speed below ~0.3 that looks smooth through scrollLeft
       alone.

       So scrollLeft carries the whole pixels and a translateX carries the
       remainder, which is a compositor property and genuinely continuous.
       The two always sum to the true position, and the transform never
       exceeds 1px, so drag and the desktop runway can keep writing
       scrollLeft without knowing this exists. */
    var carry = 0;
    function autoStep() {
      if (!paused && !dragging && !reduce) {
        carry += speed();
        var step = Math.floor(carry);
        if (step) { carry -= step; setLeft(track.scrollLeft + step); }
        track.style.transform = 'translateX(' + (-carry) + 'px)';
      }
      requestAnimationFrame(autoStep);
    }
    track.style.willChange = 'transform';
    requestAnimationFrame(autoStep);

    // drag-to-scroll (mouse + touch, via pointer events)
    //
    // Eliza (2026-10-02): "i still cannot click carousel images." Root
    // cause: setPointerCapture was called unconditionally on pointerdown,
    // for every click as well as every real drag. Once a pointer is
    // captured, the browser routes pointerup/mouseup/click for that
    // pointer to the CAPTURING element (the track) instead of whatever is
    // actually under the cursor -- so a plain click on a tile's <a> never
    // reached the link at all; it always landed on .carousel-track, which
    // has no href. Confirmed via instrumented event log: pointerdown
    // targeted the tile correctly, but click's target was the track.
    //
    // Fix: don't capture on pointerdown. Only capture once pointermove
    // proves this is a real drag (dragMoved flips true past the existing
    // 3px threshold), so a genuine drag still tracks reliably even if the
    // pointer leaves the track, while a plain click is left alone and
    // hit-tests normally at pointerup -- reaching the tile's link.
    var pointerId = null;
    track.addEventListener('pointerdown', function (e) {
      dragging = true; dragMoved = false;
      dragStartX = e.clientX;
      dragStartScroll = track.scrollLeft;
      pointerId = e.pointerId;
      track.classList.add('dragging');
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 3) {
        if (!dragMoved) track.setPointerCapture(pointerId); // first confirmed drag frame
        dragMoved = true;
      }
      setLeft(dragStartScroll - dx);
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
    // Horizontal mouse/trackpad scroll takes over a pre-footer carousel the same
    // way it does the top one (that track scrolls natively; this one is
    // overflow:hidden because the page scroll drives it, so it needs this).
    // Only mostly-horizontal gestures are claimed -- vertical wheel still
    // scrolls the page and still drives the carousel through the runway.
    if (isHijacked) {
      var wheelTimer = null;
      track.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        paused = true;
        setLeft(track.scrollLeft + e.deltaX);
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(function () { paused = false; }, 600);
      }, { passive: false });
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', function (e) { if (dragging && e.buttons === 0) endDrag(e); });

    if (isHijacked) hijacked.push({
      el: el, track: track,
      setPaused: function (p) { paused = p; },
      loopWidth: loopWidth, setLeft: setLeft,
      base: 0, engaged: false
    });
  });

  /* ---------------- pre-footer carousel: scroll runway ----------------
     Eliza: "could we set the rule so that forced scroll happens once the
     top of the carousel is flush with the nav bar? ... goal is 1. it feels
     cool 2. you're scrolling and able to fully see the carousel as you
     scroll."

     Her rule and the OLD rule (fire at the document bottom) cannot both
     hold. Below the fold there is 197 of collapsed bar + 424 of band and
     captions + 594 of footer = 1215px of content against a ~900 viewport,
     so "band flush under the bar" happens ~315px BEFORE the page runs out
     of scroll. That 315 is exactly how much of the band was being eaten
     before the old takeover fired. Shortening the footer can't close it --
     ours already renders ~508 against Figma's 554.

     So: give the section a runway. The pane pins flush under the bar and
     HOLDS while the runway is consumed, the footer rising into the space
     underneath it, and the scroll drives the carousel sideways the whole
     way. Runway spent -> pane releases -> page finishes normally.

     Driven by scroll POSITION, not by intercepting wheel events. Same
     lesson as the header: no preventDefault, so the page is never held
     hostage, scrolling up reverses it exactly, momentum behaves, and
     there's no timer running on its own clock next to the scroll.

     RUNWAY is sized so the footer sits exactly at the fold when the pane
     pins -- any longer and you'd see a band of empty orange under the
     carousel waiting for the footer, which is the dead space round 10 was
     spent removing. Carousel travel is decoupled from that by GAIN, so how
     far the pieces move doesn't depend on how tall the window is. -------- */
  var wrap = document.querySelector('.scroll-hijack');
  var pane = wrap && wrap.querySelector('.scroll-hijack-sticky');
  if (wrap && pane && hijacked.length) {
    var target = hijacked[0];
    /* Two numbers, one complaint each (2026-09-18, round 3).
       "a bit slower... feels too jerky" -> GAIN. At 2.5 a single 100px
       scroll event moved the carousel 250px in one frame, and amplifying
       the browser's already-lumpy scroll deltas is what read as jerk.
       Near 1:1 the pieces travel at the same rate the page would, which is
       the calmest mapping there is. Deliberately NOT fixed by easing
       toward a target: that puts a second clock next to the scroll, which
       is the exact thing that made the header jiggle.
       "like i miss it at a normal rate of scrolling" -> RUNWAY_MIN. The
       pinned stretch was 600px, about one unhurried flick; at 1000 it
       lasts long enough to register as a held moment. */
    var GAIN = 1.1;         // px of carousel travel per px of scroll
    var RUNWAY_MIN = 240;   // px -- see sizeRunway(). Was 1000 (plus the viewport remainder): the pinned stretch showed as a very wide empty orange band above the footer (Eliza 2026-10-04: 'does not even seem necessary'), so it is now just long enough to drive the carousel through a normal flick.
    /* Mobile runs the same mechanism on its own numbers. The band there is
       103 Figma px rather than 389, so one full set of four tiles is only
       ~500px wide instead of ~1600 -- desktop's travel would spin it more
       than two whole loops. These keep it to roughly one. */
    /* NOT RUN ON MOBILE. Two rounds of tuning couldn't fix the gap there
       because the geometry is inverted, not mistuned:

         desktop  670 viewport - 197 bar - 424 band  =  49 left over
         mobile   621 viewport -  68 bar - 123 band  = 430 left over

       Desktop's band nearly fills the screen under the bar, so pinning it
       costs ~49px of orange nobody sees. Mobile's fills a fifth of it, so
       pinning it MUST leave ~430px empty -- something has to occupy the
       space the footer hasn't climbed into yet. RUNWAY_MIN 700 made that
       worse; setting it to 0 removed the excess but not the 430, because
       the 430 isn't excess, it's the shape of the viewport. No constant
       fixes it.

       So on mobile the pre-footer carousel behaves like the top one: it
       drifts, it drags, it scrolls past normally. Eliza suggested exactly
       this a round before I worked out why she was right. */
    function mobile() { return window.innerWidth <= 1152; }
    var lastY = window.scrollY;
    var idleTimer = null;
    var lastTop = -1, lastVH = -1, dirty = true;

    // The sticky offset resolves from --hdr-h, which the header publishes
    // only once it docks -- so this is read live rather than cached at
    // load, when it is still 0.
    function stickyTop() { return parseFloat(getComputedStyle(pane).top) || 0; }

    /* 2026-09-18, round 2. v1 sized the runway to exactly the space left
       under the pinned band (viewport - bar - pane) so the footer would sit
       precisely at the fold and no strip of empty orange could open up.
       On Eliza's laptop that arithmetic came to NINETY-THREE PIXELS: the
       band pinned and released inside a single trackpad flick ("it almost
       stops too quickly"), and a fast scroll whose one event jumped the
       whole 93px never sampled as pinned at all, so nothing drove the
       carousel ("it glitches out"). It only worked scrolling very slowly.

       What I was protecting against was worth almost nothing: that strip is
       at most (viewport - bar - pane) TALL however long the runway is --
       93px here -- and it is orange, on an orange page, above an orange
       footer. Lengthening the runway doesn't make it bigger, only
       longer-lived.

       So: the runway is the larger of that strip and a floor big enough to
       survive a normal flick. On a short window the floor wins and costs a
       ~90px orange strip nobody can see; on a tall iMac the strip is the
       bigger number and wins on its own, putting the footer right at the
       fold as intended. One expression, right at both ends. */
    function sizeRunway() {
      if (mobile()) {                  // no runway: let the band sit in flow
        if (wrap.style.height) wrap.style.height = '';
        lastTop = -1; lastVH = -1;     // force a real measure on the way back
        return;
      }
      /* Runway no longer depends on the sticky offset. It used to
         (vh - top - paneH), and `top` moves while the header docks -- so
         the wrapper's height, and with it the document height, changed
         DURING a fast scroll, which nudged the scroll position and read
         as the pane jiggling/freezing. Using the bare viewport minus pane
         makes it a function of window size only. */
      var vh = window.innerHeight;
      if (!dirty && vh === lastVH) return;
      dirty = false; lastVH = vh;
      var paneH = pane.offsetHeight;
      wrap.style.height = (paneH + RUNWAY_MIN) + 'px';
    }
    function remeasure() { dirty = true; sizeRunway(); }
    remeasure();
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);

    /* Progress through the runway, in px: 0 before the pane pins, runway
       length once it releases. The carousel is moved by the CHANGE in this
       number, not by the raw scroll delta while "pinned" -- so a fast flick
       or an End-key jump that crosses the whole pinned stretch between two
       scroll events still moves the carousel by the full runway (it used
       to sample as never-pinned and leave the carousel static). */
    function progress() {
      var top = stickyTop();
      var pinY = window.scrollY + wrap.getBoundingClientRect().top - top;
      var len = Math.max(0, wrap.offsetHeight - pane.offsetHeight);
      return Math.min(len, Math.max(0, window.scrollY - pinY));
    }
    var lastP = progress();
    wrap.style.overflowAnchor = 'none';

    window.addEventListener('scroll', function () {
      sizeRunway();
      lastY = window.scrollY;
      var p = progress(), dp = p - lastP;
      lastP = p;
      if (mobile() || !dp) return;
      target.setPaused(true);
      target.setLeft(target.track.scrollLeft + dp * GAIN);
      clearTimeout(idleTimer);
      // drift picks back up shortly after the scroll stops, so the
      // carousel is never sitting dead
      idleTimer = setTimeout(function () { target.setPaused(false); }, 250);
    }, { passive: true });
    window.addEventListener('resize', function () { lastP = progress(); });
  }
})();
/* ---------------- contact / trade forms ----------------------------------
   The site is static, so a form needs a third party to deliver it. That
   endpoint lives in exactly ONE place per page -- data-endpoint on the
   form -- and wiring it up is editing that one string.

   Until it is set, the submit is blocked and the form SAYS so. A form that
   silently swallows an enquiry is worse than no form: the visitor believes
   they have been in touch and nobody has. The mailto fallback offered in
   the notice is a real address, not a dead end.

   Validation is native (required, type=email) for the RULES, but not for
   the UI: novalidate on the form suppresses the browser's own floating
   bubble entirely (that bubble can't be restyled -- it's OS chrome, not
   DOM), and .sf-field-error below reproduces it as a plain in-page line --
   the browser's own validationMessage text, in the site's ink colour and
   caps, sitting under the field instead of floating over it. Only appears
   after a first submit attempt (.is-validated), then live-updates per
   field as the visitor fixes things. */
(function contactForms() {
  var forms = document.querySelectorAll('form[data-endpoint]');
  // NOTE: no early return here even when forms.length is 0 -- the
  // newsletter-form wiring further down (every page's footer, not just
  // contact/trade) needs fieldErrorEl/showFieldError/clearFieldError
  // from this same closure and must still run on a page with no
  // data-endpoint form at all. The forms.forEach below is already a
  // no-op on an empty NodeList, so skipping it costs nothing.

  function fieldErrorEl(field) {
    var wrap = field.closest('.sf-field') || field.parentElement;
    var msg = wrap.querySelector('.sf-field-error');
    if (!msg) {
      msg = document.createElement('span');
      msg.className = 'sf-field-error';
      msg.setAttribute('role', 'alert');
      msg.hidden = true;
      wrap.appendChild(msg);
      if (field.id) {
        msg.id = field.id + '-error';
        field.setAttribute('aria-describedby', msg.id);
      }
    }
    return msg;
  }

  function showFieldError(field) {
    var msg = fieldErrorEl(field);
    msg.textContent = field.validationMessage;
    msg.hidden = false;
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    var wrap = field.closest('.sf-field') || field.parentElement;
    var msg = wrap.querySelector('.sf-field-error');
    if (msg) { msg.hidden = true; msg.textContent = ''; }
    field.removeAttribute('aria-invalid');
  }

  Array.prototype.forEach.call(forms, function (form) {
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    var wired = endpoint && endpoint !== 'TODO';
    if (wired) form.setAttribute('action', endpoint);

    var fields = form.querySelectorAll('input, textarea');
    Array.prototype.forEach.call(fields, function (field) {
      field.addEventListener('input', function () {
        if (!form.classList.contains('is-validated')) return;
        if (field.validity.valid) clearFieldError(field);
        else showFieldError(field);
      });
    });

    form.addEventListener('submit', function (e) {
      form.classList.add('is-validated');

      if (!form.checkValidity()) {
        e.preventDefault();
        var first = null;
        Array.prototype.forEach.call(fields, function (field) {
          if (field.validity.valid) { clearFieldError(field); return; }
          showFieldError(field);
          if (!first) first = field;
        });
        if (first) first.focus();
        return;
      }

      if (!wired) {
        e.preventDefault();
        var notice = form.querySelector('.sf-unwired');
        if (!notice) {
          var email = form.getAttribute('data-email') || 'contact@studiofritz.co';
          notice = document.createElement('p');
          notice.className = 'sf-unwired';
          notice.setAttribute('role', 'status');
          notice.innerHTML = 'This form is not connected yet \u2014 please email ' +
            '<a href="mailto:' + email + '">' + email + '</a> in the meantime.';
          form.appendChild(notice);
        }
        notice.scrollIntoView({ block: 'nearest' });
      }
    });
  });


  /* Eliza (15th pass): "ENTER YOUR EMAIL [in the footer] is too big, and
     'Please enter...' should show up native below it, not like alt text
     -- same format as forms when errors are made." The newsletter form
     (header hamburger + every page's footer, same markup repeated) had
     neither novalidate nor data-endpoint, so submit never reached any
     JS at all -- the browser's own floating validity bubble fired and
     .sf-field-error above never got a chance to run. Same
     show/clear-on-submit wiring as the contact/trade forms, just
     without the mailto-fallback notice (nothing to be "unwired" about --
     there's no backend promise being made here, just "please fill this
     in"). fieldErrorEl()'s fallback (wrap = field.parentElement when
     there's no .sf-field ancestor) is exactly the newsletter input's
     actual markup, so no HTML wrapper needed. */
  var newsletterForms = document.querySelectorAll('form[data-newsletter]');
  Array.prototype.forEach.call(newsletterForms, function (form) {
    var fields = form.querySelectorAll('input');
    Array.prototype.forEach.call(fields, function (field) {
      field.addEventListener('input', function () {
        if (!form.classList.contains('is-validated')) return;
        if (field.validity.valid) clearFieldError(field);
        else showFieldError(field);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.classList.add('is-validated');
      var first = null;
      Array.prototype.forEach.call(fields, function (field) {
        if (field.validity.valid) { clearFieldError(field); return; }
        showFieldError(field);
        if (!first) first = field;
      });
      if (first) first.focus();
    });
  });
})();

/* ------------- white supporting pages: the bar floats + turns orange -----
   header() above owns the homepage's multiply/dock sequence and bails on
   any page with no hero, so about.html and every other white page got no
   scroll behaviour of its own: the orange ramping in over the first 12%
   of a viewport height. Same constant and same driver as the homepage --
   once --hdr-bg-a moves, FRITZ, the logomark and the hamburger cross-fade
   on it for free, with no rule of their own and no CSS transition ticking
   on a second clock beside the scroll.
   Eliza 2026-10-02: "nav bar is not floating on all non-homepage pages!
   should behave like homepage nav bar after it appears." Previously this
   ramp only ran on mobile and desktop's bar was position:absolute (scrolls
   away, per an earlier deliberate choice) with none of it -- now the bar
   is position:fixed at every width (see .wordmark-header.is-static in
   css/style.css) and this same ramp drives it on desktop too. */
(function staticHeader() {
  // Eliza 2026-10-02: the scroll-driven orange background ramp this used
  // to drive (shared with the homepage's own header) made is-static bars
  // fade to solid orange behind permanently-dark-ink nav text -- "nav
  // looks weird... does not require complexity." These pages have no
  // hero/video to cross-fade out of, so the header is just a flat solid
  // white bar at every scroll position now (see css/style.css) and this
  // only has to publish its own height for --hdr-h (used by #warranty's
  // scroll-margin and the FAQ sticky offset elsewhere).
  var header = document.querySelector('.wordmark-header.is-static');
  if (!header) return;

  var root = document.documentElement;
  var lastH = -1;

  function publishHeight() {
    // floor, never round up: a fractional header (e.g. 197.6px) rounded UP leaves a
    // sub-pixel row of the pane's orange background showing under the bar.
    var h = Math.floor(header.getBoundingClientRect().height);
    if (h !== lastH) {
      lastH = h;
      root.style.setProperty('--hdr-h', h + 'px');
    }
  }

  window.addEventListener('resize', function () { lastH = -1; publishHeight(); });
  publishHeight();
})();

  /* ---------------- mobile menu (Figma 242:177) ----------------
     Click, Escape and any link inside all close it; so does crossing back
     over the breakpoint, so the panel can't be left open and invisible in a
     desktop window. The panel sits UNDER the header in z, so the wordmark
     stays exactly where it was -- opening the menu moves nothing. */
  (function () {
    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('mobileMenu');
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.hidden = !open;
      document.body.classList.toggle('menu-open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      // page behind the open menu does not scroll
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open) {
        var first = menu.querySelector('a');
        if (first) first.focus({ preventScroll: true });
      }
    }
    // keep Tab inside the open menu (+ its close button)
    function focusables() {
      return [toggle].concat(Array.prototype.slice.call(menu.querySelectorAll('a[href], button, input')));
    }

    toggle.addEventListener('click', function () { setOpen(menu.hidden); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); return; }
      if (e.key === 'Tab' && !menu.hidden) {
        var f = focusables(), i = f.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1152 && !menu.hidden) setOpen(false);
    });
  })();


  /* ---------------- SITE INTRO (index.html only, Figma "intro" /
     "intro - joins" / "intro - end state" frames) ----------------
     Eliza 2026-10-02: "get rid of the stamp entirely, change to just
     the modern F. I want it to draw in from the outer perimeters,
     joining together, and then the top 2 horizontal lines shortening
     into place, outside in." Two class flips on #introF drive the
     whole thing now -- see the .intro-f-wrap rules in css/style.css
     for exactly what each phase animates:
       .is-joining -- phase 1: top bar, mid bar and vertical bar fly
         in from past the actual edge of the viewport (right, left
         and top respectively) and land in position together, still
         at an overshoot length.
       .is-drawn -- phase 2: the two horizontal bars shrink from that
         overshoot down to true length, anchored at the end nearest
         the vertical bar, so the motion reads as the outer tip
         retracting inward ("outside in").
     Plays once per tab (sessionStorage) since it's a first-visit
     flourish, not something a returning-within-session visitor
     should sit through on every reload. Click/tap/Escape/Enter skips
     straight to the end. Reduced motion collapses it to a quick
     fade -- the durations below are wall-clock waits between class
     toggles, kept separate from the CSS transition durations (which
     the site's global prefers-reduced-motion rule already zeroes),
     so a reduced-motion visitor doesn't sit through a silent version
     of the full timeline. */
  (function () {
    var el = document.getElementById('siteIntro');
    if (!el) return;

    var SEEN_KEY = 'sfIntroSeen';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fWrap = document.getElementById('introF');
    var timers = [];
    var done = false;

    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function finish() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      timers.length = 0;
      // Snap every stage to its end state before fading out, so a skip
      // never leaves a half-joined/half-shortened mark visible for a frame.
      fWrap.classList.add('is-joining', 'is-drawn');
      el.classList.add('is-done');
      document.body.classList.remove('intro-active');
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (err) {}
      setTimeout(function () { el.classList.add('is-removed'); }, reduce ? 0 : 500);
    }

    var alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (err) {}
    if (alreadySeen) { el.classList.add('is-done', 'is-removed'); return; }

    document.body.classList.add('intro-active');
    el.addEventListener('click', finish);
    document.addEventListener('keydown', function (e) {
      if (!done && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) finish();
    });

    if (reduce) {
      // No stagewise draw -- just present the finished mark briefly,
      // long enough to read as an intentional beat, then reveal the site.
      fWrap.classList.add('is-joining', 'is-drawn');
      at(500, finish);
      return;
    }

    at(0,    function () { fWrap.classList.add('is-joining'); });   // phase 1: fly in + join, ~1.86s (vertical bar's 1.5s transition starts .36s in)
    at(1950, function () { fWrap.classList.add('is-drawn'); });     // phase 2: shorten outside-in, ~1.26s total (top .9s, mid .9s delayed .36s)
    at(4710, finish);                                               // brief hold, then fade out (.45s)
    // Eliza: "slow down the animation 200%" -- every wait above and every
    // CSS transition duration/delay in .intro-f-wrap's rules (style.css) is
    // the original value * 3.
  })();

  /* ---------------- catalogue: column parallax drift ----------------
     Eliza: "for catalogue, the 3 columns should slightly move in
     opposite vertical directions as you scroll down and up, just for
     visual effect, not functional." Scroll-linked (not a CSS
     transition) per the site's governing motion principle -- driven
     directly by scrollY so it reads as something the user's own
     scroll is doing, not a triggered animation. Desktop only; mobile
     collapses the grid to one column and drops the effect (see the
     CSS media query, which also forces transform:none there as a
     belt-and-suspenders guard). Amplitude is bounded against the
     grid's OWN scroll range through the viewport, not raw scrollY,
     so a long page never drifts a column out from under its
     neighbours, and it behaves the same on a 13" laptop and a 27"
     iMac. */
  (function catalogueParallax() {
    var grid = document.querySelector('[data-catalogue-parallax]');
    if (!grid || !document.body.classList.contains('page-catalogue')) return;
    var cols = Array.prototype.slice.call(grid.querySelectorAll('[data-parallax-dir]'));
    if (!cols.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var AMPLITUDE = 180; // px of max drift at full scroll-through, each direction -- doubled again from 90, Eliza: "make it 2x more obvious"

    function desktop() { return window.innerWidth > 1152; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function render() {
      if (!desktop()) {
        cols.forEach(function (col) { col.style.transform = ''; });
        return;
      }
      var r = grid.getBoundingClientRect();
      // Progress of the grid through the viewport: 0 as its top just
      // enters at the bottom edge, 1 as its bottom just leaves at the
      // top edge -- centered (near-zero drift) while the grid sits
      // centered in view, growing toward the extremes.
      var span = r.height + window.innerHeight;
      var progress = span > 0 ? (window.innerHeight - r.top) / span : 0.5;
      progress = clamp(progress, 0, 1);
      var offset = ((progress - 0.5) * 2 * AMPLITUDE); // -AMPLITUDE..AMPLITUDE
      cols.forEach(function (col) {
        var dir = col.getAttribute('data-parallax-dir') === '-1' ? -1 : 1;
        col.style.transform = 'translateY(' + (offset * dir).toFixed(1) + 'px)';
      });
    }

    var ticking = false;
    function onScroll() { if (!ticking) { requestAnimationFrame(function () { ticking = false; render(); }); ticking = true; } }

    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  })();

  /* ---------------- product: floating stamp ----------------
     Eliza 2026-09-28: "the stamp should float as you scroll." Same
     scroll-linked-drift technique as catalogueParallax() above (driven
     by scrollY, not a transition, so it reads as the user's own scroll
     moving it) -- but a single element with no opposite-direction
     neighbour, so it just lags behind the page at a fraction of the
     real scroll distance while its section is in view, reading as
     "floating" above the content rather than scrolling at the same
     rate as everything else. Desktop only, same reduced-motion guard. */
  /* ---------------- productFit: two GLOBAL product-page layout rules ------
     (1) s1 -- the hero image + its divider must fit below the nav bar and
         above the fold at the current window height. The gallery is
         bottom-anchored to divider 1 (823u), so a short window pulls that
         line (and everything under it) up by s1 <= 0, shrinking only the
         tall hero photo. Floor: hero never drops below 330u tall.
     (2) s2 -- the copy band between divider 1 and divider 2 is content-
         driven: copy height + the same 57u margin above and below (the
         original gap above the copy), so copy is vertically centred and a
         two-line description no longer leaves a 396u hole. Everything
         under divider 2 moves by s1 + s2 (CSS: --s).
     Desktop only; mobile flows naturally. */
  (function productFit() {
    var section = document.querySelector('.product-section');
    var uRef = document.querySelector('.product-accent-v');
    var desc = document.querySelector('.product-desc');
    if (!section || !uRef || !desc || !document.body.classList.contains('page-product')) return;
    function run() {
      if (window.innerWidth <= 1152) {
        section.style.setProperty('--s1', '0px'); section.style.setProperty('--s2', '0px');
        section.style.height = ''; var sw0 = section.querySelector('.product-swatches'); if (sw0) sw0.style.top = '';
        return;
      }
      var u = uRef.getBoundingClientRect().width / 2;
      if (!u) return;
      var top = section.getBoundingClientRect().top + window.pageYOffset;
      var avail = window.innerHeight - top - 24;
      var s1 = Math.max(-261 * u, Math.min(0, avail - 823 * u));
      var s2 = desc.offsetHeight + 114 * u - 396 * u;
      section.style.setProperty('--s1', s1.toFixed(2) + 'px');
      section.style.setProperty('--s2', s2.toFixed(2) + 'px');

      /* GLOBAL RULE (Eliza, 2026-10-03): space below the lowest content
         equals the space above it, so the content is vertically centred in
         the white slice between divider 2 and the carousel. "Above" is the
         real measured gap (divider 2 -> first content row); "below" is
         that same number under whatever ends up lowest (config list,
         swatch labels, or the CTAs). Replaces the old fixed 1811u height,
         which left a different amount of white on every page. */
      var sw = section.querySelector('.product-swatches');
      var cfg = section.querySelector('.product-config');
      var d2 = section.querySelector('.product-divider-2');
      if (sw) {
        sw.style.top = '';              // measure cfg with the CSS default first
        var cr = cfg.getBoundingClientRect();
        sw.style.top = (cr.bottom - section.getBoundingClientRect().top + 32 * u) + 'px';   // 32u between the last bullet and the swatches
      }
      var st = section.getBoundingClientRect().top;
      var first = section.querySelector('.product-dims');
      var gapAbove = (first && d2) ? first.getBoundingClientRect().top - d2.getBoundingClientRect().bottom : 61 * u;
      var low = 0;
      ['.product-dims', '.product-price', '.product-config', '.product-cta-inquire', '.product-cta-spec', '.product-swatches'].forEach(function (q) {
        var e = section.querySelector(q);
        if (e) low = Math.max(low, e.getBoundingClientRect().bottom - st);
      });
      if (low) section.style.height = (low + gapAbove).toFixed(1) + 'px';
    }
    window.addEventListener('resize', run);
    window.addEventListener('load', run);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    run();
  })();

  /* ---------------- product stamp: same pin/rest float as the other
     pages' .page-stamp (see pageStampFloat above), not a subtle in-place
     drift -----------------------------------------------------------
     Eliza (3rd pass, 2026-09-28): "the stamp is still static, it should
     float as user scrolls over below the fold content, same as the stamp
     on homepage." The previous version nudged the stamp a few px via
     transform while it stayed in normal document flow -- against a full
     page's worth of scrolling that reads as static, because the stamp
     mostly just scrolls away with everything else. What "float" actually
     means elsewhere on the site: pin the stamp in place (position:fixed)
     while the page scrolls under it, then let it come to rest just above
     the next section once that section catches up.

     One difference from .page-stamp: that element's ancestor spans the
     full viewport width, so the same `left` value works whether it's
     position:fixed (viewport-relative) or position:absolute (ancestor-
     relative). .product-stamp-soft's ancestor, .product-section, is
     centered and capped at max-width:1440u (see .product-section), so
     the two coordinate systems don't line up -- this version measures
     and pins `left` explicitly too, not just `top`. */
/* ---------------- product stamp: same pin/rest float as the other
     pages' .page-stamp AND the homepage's own .stamp -- recomputed fresh
     every frame instead of cached once ---------------------------------
     Eliza (5th pass, 2026-09-28): "stamp still not working." Found the
     actual bug: the previous version's "resting" branch set stamp.style.top
     to a number measured in .carousel's own coordinate frame (its offsetTop,
     relative to whatever ITS offsetParent is -- body/main, since .carousel
     is a sibling of .product-section, not a child of it) but applied it
     while stamp.style.position was 'absolute', which makes the browser
     resolve that top relative to stamp's OWN offsetParent (.product-section,
     the nearest positioned ancestor) -- two different coordinate spaces, so
     the "landing" spot was nowhere near the carousel. The "floating" branch
     had a second bug: it fed a document-absolute Y (section top + scrollY)
     into position:fixed's top, which is viewport-relative -- so instead of
     staying pinned in view, the stamp raced down the screen as you scrolled
     and usually ended up off-screen entirely, reading as "stuck"/invisible.
     Rewritten as three explicit states (mirrors the homepage's own .stamp /
     stampFooterStop above): natural in-flow position (untouched, stylesheet
     handles it) -> pinned to the viewport once that natural spot would
     scroll above the fold -> resting just above the section's own bottom
     edge (which already lines up exactly with where the carousel begins,
     so nothing here needs to reach into .carousel's unrelated coordinate
     frame at all). Every number is re-derived from .product-section's and
     .product-accent-v's live geometry on every single render() call -- never
     cached, never read off the stamp itself -- so a wrong frame can't
     persist into the next one. */
  (function productStampFloat() {
    var stamp = document.querySelector('.product-stamp-soft');
    var section = document.querySelector('.product-section');
    var uRef = document.querySelector('.product-accent-v'); // width: calc(2 * var(--u))
    if (!stamp || !section || !uRef || !document.body.classList.contains('page-product')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var GAP = 24;

    function desktop() { return window.innerWidth > 1152; }

    function render() {
      if (!desktop()) {
        stamp.style.position = ''; stamp.style.top = ''; stamp.style.left = '';
        return;
      }
      var uPx = uRef.getBoundingClientRect().width / 2;
      var sectionRect = section.getBoundingClientRect(); // viewport-relative, live
      var stampH = stamp.offsetHeight;

      // Where the stylesheet's own calc(847*u)/calc(46*u) puts it,
      // expressed in the current viewport. (9th pass: moved from
      // 594/1301 to 847/46 -- bottom-left under the divider line now,
      // see .product-stamp-soft in style.css.)
      var s1 = parseFloat(section.style.getPropertyValue('--s1')) || 0;
      var naturalTopViewport = sectionRect.top + 847 * uPx + s1;
      var naturalLeftViewport = sectionRect.left + 46 * uPx;

      // Where it should land once done floating: just above the section's
      // own bottom edge, in .product-section's OWN coordinate space (its
      // offsetParent once this goes absolute) -- the section's height
      // already runs exactly down to where the carousel begins, so this
      // needs nothing from .carousel itself.
      var restTopInSection = section.offsetHeight - stampH - GAP;
      var restTopViewport = sectionRect.top + restTopInSection;

      // Floats like the other pages' stamps: always on screen. It rides at
      // its natural spot while that is visible, sits at the bottom of the
      // viewport while the natural spot is still below the fold, tucks
      // under the nav bar when scrolled past, and rests above the carousel.
      var hdr = document.querySelector('.wordmark-header');
      var hdrBottom = hdr ? hdr.getBoundingClientRect().bottom : 0;
      var minTop = Math.max(GAP, hdrBottom + GAP);
      var maxTop = window.innerHeight - stampH - GAP;
      var floatTop = Math.max(minTop, Math.min(naturalTopViewport, maxTop));

      if (restTopViewport <= floatTop) {
        stamp.style.position = 'absolute';
        stamp.style.top = restTopInSection + 'px';
        stamp.style.left = ''; // back to the stylesheet's section-relative left
      } else {
        stamp.style.position = 'fixed';
        stamp.style.top = floatTop + 'px';
        stamp.style.left = naturalLeftViewport + 'px';
      }
    }

    var ticking = false;
    function onScroll() { if (!ticking) { requestAnimationFrame(function () { ticking = false; render(); }); ticking = true; } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
  })();

  /* ---------------- inquire modal: "Inquire to Purchase" popup --------------
     New per Eliza (2026-09-27, sent as a pasted Figma screenshot, not a
     linked node -- built from that image, not get_design_context). Every
     "Inquire to Purchase" button on a product page opens this modal instead
     of navigating away, with the Item(s) of Interest field pre-filled from
     that button's own data-inquire-product attribute -- so it's correct
     per-product without any page needing its own copy of this script. The
     trigger keeps a real mailto: href as a no-JS fallback (same philosophy
     as the site's other "download" fallbacks): JS only intercepts the click
     when it can actually open the modal.
     Field caps: .sf-field input/textarea already force text-transform:
     uppercase sitewide (see the shared form styles), so nothing extra is
     needed here for "force caps lock on all fields." */
  (function inquireModal() {
    var modal = document.querySelector('.inquire-modal');
    var triggers = document.querySelectorAll('[data-inquire-open]');
    if (!modal || !triggers.length) return;
    var itemField = modal.querySelector('[data-inquire-item-field]');
    var lastFocused = null;

    function open(product) {
      lastFocused = document.activeElement;
      if (itemField && product) itemField.value = product;
      modal.hidden = false;
      document.body.classList.add('inquire-modal-open');
      var nameField = modal.querySelector('input[name="name"]');
      if (nameField) nameField.focus();
    }

    function close() {
      modal.hidden = true;
      document.body.classList.remove('inquire-modal-open');
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    Array.prototype.forEach.call(triggers, function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        open(trigger.getAttribute('data-inquire-product') || '');
      });
    });

    Array.prototype.forEach.call(modal.querySelectorAll('[data-inquire-close]'), function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  })();

  /* ---------------- product gallery: fixed boxes, rotating photos ----
     Eliza (2026-10-02): "images should swap into each other's places
     right to left" -- replaces the previous resize-in-place toggle.
     The 4 boxes keep fixed positions and fixed roles (VISUAL_ORDER
     below is left-to-right on screen, matching the `order` values in
     style.css: thumb-5, cove2, hero, cove3) -- .product-hero (3rd
     position) is now PERMANENTLY the single enlarged box; is-hero
     never moves again. What changes on "next"/"prev"/a thumbnail
     click is WHICH PHOTO's image sits in each box: the whole set of 4
     photos rotates one step through the 4 boxes (a literal left shift
     on "next" -- box 1's photo moves to box 4, box 2's to box 1, box
     3's to box 2, box 4's to box 3/hero -- and the mirror shift on
     "prev"), with a brief crossfade + slide so the motion reads as
     passing through rather than teleporting. Product pages only
     (.product-gallery), desktop only: mobile shows all 4 photos at
     once in a stacked column already (see style.css), so there's
     nothing to rotate there. */
  /* ---------------- product gallery: keep-out zone around the long F ----
     GLOBAL RULE (Eliza, 2026-10-03): "no image should sit so close to the
     modern F." No photo edge may come within CLEAR (40u -- the same as the
     page's own left margin) of the F's vertical rule. A photo that
     straddles the rule outright is left alone (that's a layout choice, not
     a near-miss).

     Photo widths come from their own aspect ratios and rotate with the
     arrows, so this can't be a fixed number in CSS: it re-runs on load,
     resize, and every time a photo's src changes. Right of the F it pushes
     the box over with margin-left; left of the F it caps the photo's
     width; if that pushes the row past its right edge, the hero photo
     gives up the overflow (contain, so it only gets slightly smaller). */
  (function productClearance() {
    var gallery = document.querySelector('.product-gallery');
    var rule = document.querySelector('.product-accent-v');
    if (!gallery || !rule || !document.body.classList.contains('page-product')) return;
    var CLEAR = 40;
    var busy = false;
    function run() {
      if (busy) return; busy = true;
      var boxes = Array.prototype.slice.call(gallery.querySelectorAll('.product-photo'));
      gallery.style.justifyContent = '';
      boxes.forEach(function (b) { b.style.marginLeft = ''; var i = b.querySelector('.gallery-img'); if (i) { i.style.transition = 'none'; i.style.maxWidth = ''; } });
      if (window.innerWidth > 1152 && boxes.length) {
        var f = rule.getBoundingClientRect(), u = f.width / 2, c = CLEAR * u;
        if (u) {
          boxes.sort(function (a, b) { return (+getComputedStyle(a).order) - (+getComputedStyle(b).order); });
          boxes = boxes.filter(function (b) { return b.getBoundingClientRect().width > 0; });
          // 1. photos just LEFT of the rule: cap their width so their right edge keeps clear.
          boxes.forEach(function (b) {
            var r = b.getBoundingClientRect(), img = b.querySelector('.gallery-img');
            if (img && r.left < f.left - c + 1 && r.right > f.left - c + 1 && r.right <= f.right + c) img.style.maxWidth = Math.max(0, f.left - c - r.left) + 'px';
          });
          // 2. photos just RIGHT of the rule: lay the row out explicitly (left to right,
          // each box at its natural spot unless that spot is inside the keep-out zone).
          var gr = gallery.getBoundingClientRect();
          var nat = boxes.map(function (b) { return b.getBoundingClientRect().left; });
          var need = nat.some(function (l) { return l >= f.left - c + 1 && l < f.right + c - 1; });
          if (need) {
            var gap = 24 * u, heroImg = gallery.querySelector('.product-hero .gallery-img');
            gallery.style.justifyContent = 'flex-start';
            for (var round = 0; round < 3; round++) {
              var cursor = gr.left, over = 0;
              boxes.forEach(function (b, i) {
                var w = b.getBoundingClientRect().width, left = nat[i];
                if (left >= f.left - c + 1 && left < f.right + c - 1) left = f.right + c;
                var g = i > 0 ? gap : 0;        // the row's own flex gap sits between boxes
                left = Math.max(left, cursor + g);
                b.style.marginLeft = (left - cursor - g) + 'px';
                cursor = left + w;
              });
              over = cursor - gr.right;
              if (over <= 0.5 || !heroImg) break;
              heroImg.style.maxWidth = Math.max(0, heroImg.getBoundingClientRect().width - over) + 'px';
            }
          }
        }
      }
      busy = false;
    }
    var lastSig = '';
    function sig() {
      return window.innerWidth + '|' + Array.prototype.map.call(gallery.querySelectorAll('.gallery-img'), function (i) {
        return i.currentSrc + ':' + i.naturalWidth + 'x' + i.naturalHeight;
      }).join(',');
    }
    function soon() { requestAnimationFrame(function () { requestAnimationFrame(function () { lastSig = sig(); run(); }); }); }
    // images can finish decoding at any point (lazy loading, cache) -- poll the signature cheaply
    // rather than trust a load event we might have registered after the fact.
    var polls = 0;
    (function poll() { if (sig() !== lastSig) soon(); if (++polls < 40) setTimeout(poll, 250); })();
    window.addEventListener('load', soon);
    window.addEventListener('resize', soon);
    gallery.addEventListener('load', soon, true);
    gallery.addEventListener('transitionend', function (e) { if (e.propertyName === 'height') soon(); });
    if (window.MutationObserver) new MutationObserver(soon).observe(gallery, { attributes: true, attributeFilter: ['src'], subtree: true });
    soon();
  })();

  (function productGallery() {
    var galleries = document.querySelectorAll('.product-gallery');
    function desktop() { return window.innerWidth > 1152; }

    Array.prototype.forEach.call(galleries, function (gallery) {
      var hero = gallery.querySelector('.product-hero');
      var cove2 = gallery.querySelector('.product-thumb-cove2');
      var cove3 = gallery.querySelector('.product-thumb-cove3');
      var thumb5 = gallery.querySelector('.product-thumb-5');
      var section = gallery.closest('.product-section') || gallery.parentElement;
      var prevBtn = section ? section.querySelector('[data-gallery-prev]') : null;
      var nextBtn = section ? section.querySelector('[data-gallery-next]') : null;
      // Pages supply 1-4 distinct photos (never repeated to fill space); any
      // missing slot's <figure> is simply absent from the markup.
      if (!hero) return;
      if (!desktop()) return; // mobile: leave every box at its own fixed size

      // Left-to-right visual order (matches `order` in style.css).
      var boxes = [thumb5, cove2, hero, cove3].filter(Boolean);
      var N = boxes.length;
      var HERO_INDEX = boxes.indexOf(hero); // .product-hero's position in `boxes` -- always the enlarged box now
      if (N < 2) {
        var navWrap = section && section.querySelector('.product-nav-arrows');
        if (navWrap) navWrap.style.display = 'none';
        hero.classList.add('is-hero');
        return;
      }
      hero.classList.add('is-hero'); // permanent: no longer toggled between boxes

      var imgs = boxes.map(function (b) { return b.querySelector('.gallery-img'); });
      var data = imgs.map(function (img) {
        return { src: img.getAttribute('src'), alt: img.getAttribute('alt') };
      });

      function mod(n) { return ((n % N) + N) % N; }

      // Rotates the 4 photos' DATA by k boxes (newData[j] = data[(j+k)%4]) --
      // k=1 is the "next" shift described above; k=3 (i.e. -1) is "prev".
      function rotateBy(k) {
        var next = imgs.map(function (_, j) { return data[mod(j + k)]; });
        data = next;
      }

      var swapping = false;
      // Eliza (2026-10-02): "can we make the time on all white during
      // fade 0? so that there's never just all white, even if it means
      // the new image starts to come in as the old image fades away."
      // The previous version was sequential, not a crossfade -- every
      // photo faded ALL THE WAY to opacity 0 (a blank beat), only THEN
      // did the src swap and fade back in. There's only one <img> per
      // box (the src is what rotates), so a true overlap needs a second
      // layer: clone each img showing the OLD photo on top, drop the NEW
      // photo straight onto the real (now-hidden-under-the-clone) img
      // underneath, then fade the clone out and the real img in at the
      // same time. The clone is position:absolute (.product-photo is the
      // positioned ancestor) so it sits exactly over the live img without
      // disturbing the box's own layout.
      var DURATION = 300;
      function swap(k, dirSign) {
        if (swapping || mod(k) === 0) return;
        swapping = true;
        var exitOffset = dirSign * -16; // "next" photos exit left, "prev" exit right
        var oldData = data.slice();
        rotateBy(k);
        var newData = data;

        var clones = imgs.map(function (img, i) {
          var clone = img.cloneNode(false);
          clone.removeAttribute('data-gallery-thumb');
          clone.setAttribute('src', oldData[i].src);
          clone.setAttribute('alt', '');
          clone.style.position = 'absolute';
          clone.style.inset = '0';
          clone.style.margin = '0';
          clone.style.pointerEvents = 'none';
          clone.style.opacity = '1';
          clone.style.transform = 'translateX(0)';
          clone.style.transition = 'none';
          img.parentElement.appendChild(clone);
          return clone;
        });

        // Real img becomes the NEW photo right away, starting from the
        // entry side at opacity 0 -- it's fully hidden under the clone,
        // so this is invisible until the crossfade below begins.
        imgs.forEach(function (img, i) {
          img.setAttribute('src', newData[i].src);
          img.setAttribute('alt', newData[i].alt);
          img.style.transition = 'none';
          img.style.opacity = '0';
          img.style.transform = 'translateX(' + (-exitOffset) + 'px)';
        });

        // Force a synchronous layout flush so the "before" state set
        // above (clone at full opacity/rest position, real img at
        // opacity 0) is actually committed before switching on
        // transitions and moving to the "after" state -- without this,
        // the browser can coalesce both style writes into one frame and
        // jump straight to the end value instead of animating (confirmed
        // via instrumented opacity sampling: double-rAF alone left a
        // freshly-appended clone's computed opacity frozen at its start
        // value, then it snapped to the end value with no visible tween).
        clones.forEach(function (clone) { void clone.offsetWidth; });
        imgs.forEach(function (img) { void img.offsetWidth; });

        clones.forEach(function (clone) {
          clone.style.transition = 'opacity ' + DURATION + 'ms cubic-bezier(.4,0,.2,1), transform ' + DURATION + 'ms cubic-bezier(.4,0,.2,1)';
          clone.style.opacity = '0';
          clone.style.transform = 'translateX(' + exitOffset + 'px)';
        });
        imgs.forEach(function (img) {
          img.style.transition = 'opacity ' + DURATION + 'ms cubic-bezier(.4,0,.2,1), transform ' + DURATION + 'ms cubic-bezier(.4,0,.2,1)';
          img.style.opacity = '';
          img.style.transform = '';
        });
        setTimeout(function () {
          clones.forEach(function (clone) { clone.remove(); });
          swapping = false;
        }, DURATION + 40);
      }

      function step(delta) { swap(delta > 0 ? 1 : N - 1, delta > 0 ? 1 : -1); }

      if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });

      // Clicking any thumbnail rotates the set so that photo lands in the hero box.
      Array.prototype.forEach.call(gallery.querySelectorAll('[data-gallery-thumb]'), function (thumb) {
        var i = boxes.indexOf(thumb);
        if (i === -1) return;
        thumb.addEventListener('click', function () {
          var k = mod(i - HERO_INDEX);
          swap(k, k <= N / 2 ? 1 : -1);
        });
      });

      // Eliza: "we should also be able to drag left and right on the
      // product carousel." Pointer Events cover mouse + touch + pen in
      // one code path; a small distance threshold keeps an ordinary
      // click/tap from also firing a swipe. Drag always reads from the
      // hero box now (the one fixed enlarged position).
      var dragging = false, startX = 0, startY = 0, pointerId = null;
      var THRESHOLD = 40;

      function activeEl() { return hero; }

      // Belt-and-suspenders alongside draggable="false" + -webkit-user-drag:none
      // in the markup/CSS (see .gallery-img): a real click-drag starting on an
      // <img> can still kick off the browser's native HTML5 drag-and-drop
      // (a ghost image, no further pointermove) in browsers that don't honor
      // one of those alone, which is what silently ate Eliza's click-drag.
      gallery.addEventListener('dragstart', function (e) { e.preventDefault(); });

      gallery.addEventListener('pointerdown', function (e) {
        if (!e.target.closest('.product-photo')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        pointerId = e.pointerId;
        activeEl().classList.add('is-dragging');
      });

      gallery.addEventListener('pointermove', function (e) {
        if (!dragging || e.pointerId !== pointerId) return;
        if (Math.abs(e.clientX - startX) > 10 && Math.abs(e.clientX - startX) > Math.abs(e.clientY - startY)) {
          e.preventDefault();
        }
      });

      // Eliza: "there is some glitch when i drag scroll only (not when
      // clicking the arrows) where it changes photo and then changes
      // photo again after (so 2 photos later)." Root cause: a trackpad
      // click-drag fires pointer events (handled below) AND, both DURING
      // the drag and for a while AFTER release, residual trackpad
      // momentum/gesture recognition on some devices/browsers also fires
      // `wheel` events for the same physical gesture -- so endDrag() and
      // the wheel handler could both call step() for one gesture.
      // A single shared time-based cooldown (first version of this fix)
      // wasn't enough on its own: a real click-drag can easily run past a
      // short cooldown window before the user releases, so the wheel
      // path's lock had already expired by the time pointerup fired its
      // own step(). Two separate measures now, not one:
      //   1. While `dragging` is true, wheel deltaX is ignored outright --
      //      the pointer path owns the gesture until release, so a wheel
      //      event firing mid-drag can never sneak a step in first.
      //   2. After EITHER path fires a step, a cooldown (long enough to
      //      cover typical trackpad inertia, not just the gesture itself)
      //      blocks the other path from firing its own step for the same
      //      physical swipe.
      var gestureLocked = false;
      function lockGesture() {
        gestureLocked = true;
        setTimeout(function () { gestureLocked = false; }, 900);
      }

      function endDrag(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        activeEl().classList.remove('is-dragging');
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          if (gestureLocked) return;
          lockGesture();
          step(dx < 0 ? 1 : -1);
        }
      }

      gallery.addEventListener('pointerup', endDrag);
      gallery.addEventListener('pointercancel', function () {
        dragging = false;
        activeEl().classList.remove('is-dragging');
      });

      // Eliza: "carousel force horizontal scroll not working" -- a
      // trackpad two-finger swipe fires wheel events, not pointer
      // events, so the drag handling above never saw it. Treat a
      // mostly-horizontal wheel gesture the same as a drag: advance one
      // step, then ignore further wheel deltas (and any drag-triggered
      // step) for the cooldown window so one swipe doesn't fire through
      // several boxes, or double up with the pointer path above.
      gallery.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (dragging || gestureLocked) return;
        lockGesture();
        step(e.deltaX > 0 ? 1 : -1);
      }, { passive: false });
    });
  })();



/* Footer wordmark (mobile): STUDIO and FRITZ are both fitted so their INK runs
   exactly edge to edge inside the footer's side padding. Same font size for
   both; STUDIO sets it, FRITZ (which is letter-spaced) absorbs the difference
   in tracking. Measured with canvas so glyph side-bearings don't leave either
   word short of the margin. */
(function footerWordmarkFit() {
  var wm = document.querySelector('.footer-wm');
  if (!wm) return;
  var studio = wm.querySelector('.fw-cream'), fritz = wm.querySelector('.fw-white');
  var footer = document.querySelector('.site-footer');
  if (!studio || !fritz || !footer) return;
  var ctx = document.createElement('canvas').getContext('2d');
  function reset() {
    [studio, fritz].forEach(function (s) { s.style.fontSize = ''; s.style.letterSpacing = ''; s.style.marginLeft = ''; });
  }
  function ink(el, text, px, ls) {
    var cs = getComputedStyle(el);
    ctx.font = cs.fontWeight + ' ' + px + 'px ' + cs.fontFamily;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (ls || 0) + 'px';
    var m = ctx.measureText(text);
    return { left: -m.actualBoundingBoxLeft, width: m.actualBoundingBoxRight + m.actualBoundingBoxLeft };
  }
  function fit() {
    reset();
    if (window.innerWidth > 1152) return;
    var cs = getComputedStyle(footer);
    var W = footer.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var base = parseFloat(getComputedStyle(studio).fontSize);
    var t1 = studio.textContent.trim(), t2 = fritz.textContent.trim();
    var a = ink(studio, t1, base, 0);
    if (!a.width) return;
    var fs = base * W / a.width;
    studio.style.fontSize = fs + 'px'; fritz.style.fontSize = fs + 'px';
    studio.style.marginLeft = (-ink(studio, t1, fs, 0).left) + 'px';
    var b = ink(fritz, t2, fs, 0);
    var ls = (W - b.width) / Math.max(1, t2.length - 1);
    fritz.style.letterSpacing = ls + 'px';
    fritz.style.marginLeft = (-b.left) + 'px';
    /* Correction pass: canvas and DOM disagree slightly once letter-spacing is
       applied, so read the real right edge of the last glyph back from the DOM
       and nudge the tracking until it lands on the margin. */
    var last = t2.charAt(t2.length - 1), fcs = getComputedStyle(fritz);
    ctx.font = fcs.fontWeight + ' ' + fs + 'px ' + fcs.fontFamily;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    var lm = ctx.measureText(last), rb = lm.width - lm.actualBoundingBoxRight;
    var target = footer.getBoundingClientRect().left + parseFloat(cs.paddingLeft) + W;
    for (var i = 0; i < 2; i++) {
      var rg = document.createRange(); rg.selectNodeContents(fritz);
      var inkRight = rg.getBoundingClientRect().right - ls - rb;
      ls += (target - inkRight) / Math.max(1, t2.length - 1);
      fritz.style.letterSpacing = ls + 'px';
    }
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
})();
