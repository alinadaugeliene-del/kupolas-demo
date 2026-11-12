/* ==========================================================
   KUPOLAS — intro: kadrų seka, valdoma slinkimu
   Video paverstas 75 kadrais (images/seka/). Slenkant kadrai
   tik „perverčiami“ ant drobės – tai daug lengviau nei video persukimas,
   todėl neužstringa ir telefone. Tarp kadrų – švelnus persiliejimas.
   ========================================================== */
(function () {
  var root = document.getElementById('kupolas-intro');
  if (!root) return;

  var canvas = root.querySelector('.kp-canvas');
  var ctx = canvas.getContext('2d', { alpha: false });
  var caps = [].slice.call(root.querySelectorAll('.kp-cap'));
  var hint = root.querySelector('.kp-hint');
  var bar = root.querySelector('.kp-bar b');

  var N = parseInt(canvas.dataset.frames, 10) || 75;
  var HOLD = 0.8;
  var isPhone = Math.min(window.innerWidth, screen.width) < 760;
  var base = isPhone ? canvas.dataset.mobile : canvas.dataset.desktop;
  var frames = new Array(N), loaded = 0;

  var target = 0, prog = 0, visible = true, drawn = -1;
  var capState = caps.map(function () { return null; }), hintState = null, barState = '';

  function clamp(v) { return Math.min(1, Math.max(0, v)); }
  function src(i) { return base + String(i + 1).padStart(3, '0') + '.webp'; }

  function readScroll() {
    var r = root.getBoundingClientRect();
    var total = Math.max(1, r.height - window.innerHeight);
    target = clamp(-r.top / total);
  }

  /* ---------- kadrų įkėlimas: pirmas – iškart, tada kas 8-as (kad greit būtų „skeletas“), tada likę ---------- */
  var order = [0];
  for (var s = 8; s >= 1; s = s / 2 | 0) {
    for (var i = 0; i < N; i += s) if (order.indexOf(i) < 0) order.push(i);
    if (s === 1) break;
  }
  if (order.indexOf(N - 1) < 0) order.push(N - 1);

  function load(i) {
    return new Promise(function (res) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        var done = function (bmp) { frames[i] = bmp || img; loaded++; if (loaded === 1) sizeCanvas(frames[i]); drawn = -1; res(); };
        if (img.decode) img.decode().then(function () { done(); }, function () { done(); });
        else done();
      };
      img.onerror = function () { res(); };
      img.src = src(i);
    });
  }
  // iki 6 vienu metu
  (function pump() {
    var running = 0, k = 0;
    function next() {
      while (running < 6 && k < order.length) {
        running++;
        load(order[k++]).then(function () { running--; next(); });
      }
    }
    next();
  })();

  function sizeCanvas(img) {
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    root.classList.add('is-ready');
  }

  // artimiausias jau įkeltas kadras
  function nearest(i) {
    if (frames[i]) return i;
    for (var d = 1; d < N; d++) {
      if (i - d >= 0 && frames[i - d]) return i - d;
      if (i + d < N && frames[i + d]) return i + d;
    }
    return -1;
  }

  function draw() {
    if (!loaded) return;
    // skrydis užima 80 % slinkimo, paskutiniai 20 % – sustojimas su rezervacijos mygtuku
    var pos = clamp(prog / HOLD) * (N - 1), a = Math.floor(pos), f = pos - a;
    var key = Math.round(pos * 20); // perpiešiame tik pasikeitus vaizdui
    if (key === drawn) return;
    drawn = key;
    var ia = nearest(a);
    if (ia < 0) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(frames[ia], 0, 0, canvas.width, canvas.height);
    var b = Math.min(N - 1, a + 1);
    if (f > 0.05 && ia === a && frames[b]) {
      ctx.globalAlpha = f;
      ctx.drawImage(frames[b], 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  function ui() {
    caps.forEach(function (c, i) {
      var on = prog >= +c.dataset.from && prog <= +c.dataset.to;
      if (on !== capState[i]) { c.classList.toggle('kp-on', on); capState[i] = on; }
    });
    var h = prog > 0.03 ? 0 : 1;
    if (hint && h !== hintState) { hint.style.opacity = h; hintState = h; }
    var bh = (prog * 100).toFixed(1) + '%';
    if (bar && bh !== barState) { bar.style.height = bh; barState = bh; }
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    if (Math.abs(target - prog) < 0.0005) prog = target;
    else prog += (target - prog) * 0.12;
    draw();
    ui();
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(root);
  }

  readScroll(); prog = target; frame();
})();
