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
    var MULTIPLY_START = 80; // scroll (px) before the wordmark starts multiplying at all
    var ROW_STAGGER = 225; // extra scroll (px) required between row 2 and row 3 turning on -- scaled up with the slower transition so row 2 visibly finishes before row 3 starts
    var PARA_FADE_ZONE = 160; // px of header-to-paragraph clearance over which .hero-intro smoothly fades out -- large enough that opacity always reaches 0 well before the header could physically reach the paragraphs
    var JOIN_BUFFER = 8; // dock the instant the nav would otherwise be covered, not a frame late
    var UNJOIN_MARGIN = 48; // extra hysteresis (px) before un-joining on the way back up, so it doesn't flicker right at the boundary
    var NAV_INSET = 16; // how far the nav tucks up from the collapsed bar's own bottom edge

    var header = document.getElementById('wmHeader');
    var nav = document.getElementById('heroNav');
    var heroContent = document.querySelector('.hero-content');
    var heroEl = document.getElementById('hero'); // round 10 backstop: never let the header stay transparent once the hero itself has scrolled out from under it
    var heroIntro = document.querySelector('.hero-intro');
    var row1 = header ? header.querySelector('.wm-row-1') : null;
    var rows2 = document.querySelectorAll('.wm-row-2');
    var rows3 = document.querySelectorAll('.wm-row-3');
    if (!header || !nav || !heroContent || !row1 || !rows2.length || !rows3.length) return;

    var ticking = false;
    var pinned = false;
    var row2OnAtY = null; // scrollY at which row 2 first turned on this downward pass -- drives the stagger
    var navDocTop = null; // nav's natural top in DOCUMENT coordinates -- stable while unpinned, since .hero-content is a %-of-.hero position independent of scroll or of how tall the header currently is

    // True intrinsic header height for a given hypothetical row state, from
    // each row's own scrollHeight (unaffected by max-height/overflow:hidden
    // or by a transition currently in flight) -- never a live, possibly
    // mid-animation, getBoundingClientRect() read.
    function predictedHeaderBottom(on2, on3) {
      var padTop = parseFloat(getComputedStyle(header).paddingTop) || 0;
      var h = padTop + row1.scrollHeight;
      if (on2) h += rows2[0].scrollHeight;
      if (on3) h += rows3[0].scrollHeight;
      return h + padTop; // header's own top/bottom padding match pre-collapse
    }

    function setRows(on2, on3) {
      rows2.forEach(function (el) { el.classList.toggle('is-on', on2); });
      rows3.forEach(function (el) { el.classList.toggle('is-on', on3); });
    }

    function setCollapsed(on) {
      header.classList.toggle('is-collapsed', on);
      // round 10: "as i scroll back up... seamlessly reveal the rest of
      // the bluff table background and video" -- going solid stays an
      // instant hard cut (0s), but reverting fades smoothly, via a CSS
      // var the ::before rule's transition-duration reads.
      header.style.setProperty('--hdr-reveal', on ? '0s' : '.6s');
      header.style.setProperty('--hdr-bg-a', on ? 1 : 0);
    }

    function render() {
      ticking = false;
      var y = window.scrollY;
      var mobile = window.innerWidth <= 900;

      if (!pinned) navDocTop = nav.getBoundingClientRect().top + y;

      if (mobile) {
        setRows(false, false);
        setCollapsed(false);
        if (heroIntro) heroIntro.style.opacity = '';
        if (pinned) { nav.classList.remove('is-pinned', 'is-collapsed-nav'); nav.style.top = ''; pinned = false; row2OnAtY = null; }
        return;
      }

      if (!pinned) {
        // -- multiply, one row at a time, purely on scroll distance + stagger.
        // No longer gated by paragraph proximity -- see the comment above:
        // the paragraphs protect themselves independently (fade below), so
        // the rows are free to reach a full triple every time. --
        var row2On = y > MULTIPLY_START;
        if (row2On && row2OnAtY === null) row2OnAtY = y;
        if (!row2On) row2OnAtY = null;
        var staggered = row2OnAtY !== null && (y - row2OnAtY) >= ROW_STAGGER;
        var row3On = row2On && staggered;
        setRows(row2On, row3On);

        var headerBottom = predictedHeaderBottom(row2On, row3On);

        // -- paragraphs fade out smoothly as the header's predicted bottom
        // edge closes in on them, so they are already invisible well
        // before any visual overlap could happen ("drop off and
        // disappear... rather than go behind it") -- proportional to the
        // real live gap, so it self-adjusts to any viewport height. --
        if (heroIntro) {
          var contentTop = heroContent.getBoundingClientRect().top;
          var gap = contentTop - headerBottom;
          heroIntro.style.opacity = clamp(gap / PARA_FADE_ZONE, 0, 1);
        }

        // -- join trigger: has the nav's own natural (still in normal flow)
        // position now reached the header, whatever the header's current
        // height happens to be? This is a physical condition, not a
        // permissive one, so it can never fire while there's still daylight
        // between the nav and the header -- and since the paragraphs sit
        // above the nav in the same block, they're already clear by now. --
        var navNaturalTop = navDocTop - y;
        var heroScrolledOut = heroEl && heroEl.getBoundingClientRect().bottom <= headerBottom + JOIN_BUFFER;
        // round 10: don't let the header join/collapse mid-multiply --
        // once row 2 is on but row 3 hasn't had its full ROW_STAGGER yet,
        // the header's own growing height was reaching the nav (and
        // triggering an early join) before the 3x multiply ever got to
        // play out, per Eliza: "the three times multiplication seems to
        // be gone." Hold off joining while multiplyPending, UNLESS the
        // hero has physically scrolled out from under the header first --
        // that backstop still overrides, so a short viewport can't strand
        // the header transparent while it waits for a multiply that will
        // never fit.
        var multiplyPending = row2On && !row3On;
        var navReached = navNaturalTop <= headerBottom + JOIN_BUFFER;
        if ((navReached && !multiplyPending) || heroScrolledOut) {
          var startTop = nav.getBoundingClientRect().top;
          nav.style.top = startTop + 'px';
          nav.classList.add('is-pinned', 'is-collapsed-nav');
          void nav.offsetHeight;
          pinned = true;
          // collapse happens in the SAME instant as join -- no lingering
          // phase where the nav is pinned over a still-transparent header
          setRows(false, false);
          setCollapsed(true);
          if (heroIntro) heroIntro.style.opacity = 0;
        } else {
          setCollapsed(false);
        }
      }

      if (pinned) {
        if (heroIntro) heroIntro.style.opacity = 0;
        var bottom = header.getBoundingClientRect().bottom;
        nav.style.top = (bottom - nav.offsetHeight - NAV_INSET) + 'px';
        // reverse of the join condition, plus a hysteresis margin, so
        // scrolling back up un-joins smoothly instead of flickering right
        // at the boundary
        var singleLineBottom = predictedHeaderBottom(false, false);
        var natTop = navDocTop - y;
        if (natTop > singleLineBottom + JOIN_BUFFER + UNJOIN_MARGIN) {
          nav.classList.remove('is-pinned', 'is-collapsed-nav');
          nav.style.top = '';
          setCollapsed(false);
          pinned = false;
          row2OnAtY = null;
        }
      }
    }
    function onScroll() { if (!ticking) { requestAnimationFrame(render); ticking = true; } }
    function onResize() { row2OnAtY = null; onScroll(); }
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
