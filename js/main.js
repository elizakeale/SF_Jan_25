// Studio Fritz — homepage header: hero -> multiply -> collapse
// Ported from the approved scroll prototype (Figma "Homepage - Scroll" /
// "Homepage - Nav Bar Collapse" states, 218:3 / 218:69).
(function () {
  var HERO_END = 300, PEAK = 900, COLLAPSE_END = 1300;
  var header = document.getElementById('wmHeader');
  var stamp = document.querySelector('.stamp');
  var rows2 = document.querySelectorAll('.wm-row-2');
  var rows3 = document.querySelectorAll('.wm-row-3');
  if (!header) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ticking = false;

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  function render() {
    ticking = false;
    var y = window.scrollY;

    stamp.style.setProperty('--stamp-a', clamp(y / 120));

    var tm = clamp((y - HERO_END) / (PEAK - HERO_END));
    var tc = clamp((y - PEAK) / (COLLAPSE_END - PEAK));

    var row2Op = clamp(tm * 2) * (1 - tc);
    var row3Op = clamp(tm * 2 - 1) * (1 - tc);
    rows2.forEach(function (el) {
      el.style.opacity = row2Op;
      el.style.transform = 'translateY(' + (10 - row2Op * 10) + 'px)';
    });
    rows3.forEach(function (el) {
      el.style.opacity = row3Op;
      el.style.transform = 'translateY(' + (10 - row3Op * 10) + 'px)';
    });

    header.style.setProperty('--hdr-bg-a', tc);
    header.style.setProperty('--nav-a', Math.max(1 - tm * 0.5, tc));
  }

  function onScroll() {
    if (!ticking) { requestAnimationFrame(render); ticking = true; }
  }

  if (reduce) { header.style.transition = 'none'; }
  window.addEventListener('scroll', onScroll, { passive: true });
  render();
})();
