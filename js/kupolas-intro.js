/* ==========================================================
   KUPOLAS — intro: video, valdomas slinkimu
   Slenki žemyn → video „skrenda“ pirmyn; slenki aukštyn → atgal.
   ========================================================== */
(function () {
  var root = document.getElementById('kupolas-intro');
  if (!root) return;

  var video = root.querySelector('.kp-video');
  var caps = [].slice.call(root.querySelectorAll('.kp-cap'));
  var hint = root.querySelector('.kp-hint');
  var bar = root.querySelector('.kp-bar b');

  var target = 0, prog = 0, visible = true, ready = false, lastTime = -1;

  function clamp(v) { return Math.min(1, Math.max(0, v)); }

  function readScroll() {
    var r = root.getBoundingClientRect();
    var total = Math.max(1, r.height - window.innerHeight);
    target = clamp(-r.top / total);
  }

  // Telefone – mažesnis video (1,4 MB vietoj 3 MB); src nustatomas tik čia, kad nesikrautų abu
  var isPhone = video.dataset.mobile && Math.min(window.innerWidth, screen.width) < 760;
  video.setAttribute('src', isPhone ? video.dataset.mobile : (video.dataset.src || video.getAttribute('src')));

  // Visas video įkeliamas į atmintį – tada persukimas sklandus net be serverio „Range“ palaikymo
  if (window.fetch && location.protocol !== 'file:') {
    fetch(video.getAttribute('src'))
      .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
      .then(function (b) { video.src = URL.createObjectURL(b); })
      .catch(function () { /* paliekame įprastą src */ });
  }

  video.addEventListener('loadeddata', function () {
    ready = true;
    video.pause();
    video.classList.add('is-loaded');
    lastTime = -1;
  });

  function render() {
    if (ready && !video.seeking && video.duration) {
      var t = prog * (video.duration - 0.05);
      if (Math.abs(t - lastTime) > 0.01) { video.currentTime = t; lastTime = t; }
    }
    caps.forEach(function (c) {
      c.classList.toggle('kp-on', prog >= +c.dataset.from && prog <= +c.dataset.to);
    });
    if (hint) hint.style.opacity = prog > 0.03 ? 0 : 1;
    if (bar) bar.style.height = (prog * 100).toFixed(1) + '%';
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    prog += (target - prog) * 0.1;
    if (Math.abs(target - prog) < 0.0005) prog = target;
    render();
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(root);
  }

  readScroll(); prog = target; frame();
})();
