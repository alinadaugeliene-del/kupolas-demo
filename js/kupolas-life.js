/* ==========================================================
   KUPOLAS — „gyvas“ hero sluoksnis ant video
   • medžiai švelniai linguoja nuo vėjo (WebGL iškraipymas tik tamsiai žaliose vietose)
   • ežeras raibuliuoja, šilta šviesa languose ir krosnelėje mirga
   • garai kyla iš kubilo ir juda kartu su juo
   Jei WebGL nepalaikomas – lieka paprastas video.
   ========================================================== */
window.KupolasLife = function (video) {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.createElement('canvas');
  canvas.className = 'kp-canvas';
  var gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl || reduce) return null;

  var VS = 'attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }';
  var FS = [
    'precision mediump float;',
    'uniform sampler2D tex; uniform float time; uniform vec4 dome; uniform float treeAmt; varying vec2 v;',
    'float luma(vec3 c){ return dot(c, vec3(.299,.587,.114)); }',
    'void main(){',
    '  vec2 uv = v;',
    '  vec3 c0 = texture2D(tex, uv).rgb;',
    '  vec3 cm = (c0 + texture2D(tex, uv+vec2(.004,0.)).rgb + texture2D(tex, uv-vec2(.004,0.)).rgb',
    '           + texture2D(tex, uv+vec2(0.,.006)).rgb + texture2D(tex, uv-vec2(0.,.006)).rgb) / 5.;',
    '  float l = luma(cm);',
    /* medžiai: tamsu ir žalsva, daugiau judesio viršuje (viršūnės) */
    '  float green = smoothstep(-.02, .05, cm.g - max(cm.r, cm.b) * .92);',
    '  float dark = 1. - smoothstep(.2, .4, l);',
    '  float tree = clamp(green * dark + dark * .3, 0., 1.) * (1. - smoothstep(.3, .85, uv.y)) * treeAmt;',
    /* kupolas nejuda: elipsė pagal jo vietą kadre, su švelniu kraštu */
    '  vec2 dc = (uv - (dome.xy + dome.zw) * .5) / max((dome.zw - dome.xy) * .5, vec2(.001));',
    '  float keep = smoothstep(.92, 1.18, length(dc));',
    '  tree *= keep;',
    '  float gust = .65 + .35 * sin(time * .37) * sin(time * .13 + 1.);',
    '  float wind = sin(time*1.1 + uv.y*6. + uv.x*2.)*.6 + sin(time*2.3 + uv.x*11. + uv.y*4.)*.3 + sin(time*4.9 + uv.x*31. + uv.y*17.)*.1;',
    '  vec2 off = vec2(wind * gust * .0034 * tree, sin(time*1.7 + uv.x*9.) * .0006 * tree);',
    /* ežeras: melsva, šviesesnė juosta vidurinėje kadro dalyje */
    '  float water = smoothstep(.02, .07, cm.b - cm.r) * smoothstep(.32, .48, l) * (1. - smoothstep(.75, .9, l))',
    '              * smoothstep(.28, .4, uv.y) * (1. - smoothstep(.62, .72, uv.y)) * keep * treeAmt;',
    '  off.y += sin(time*2.4 + uv.x*90. + uv.y*40.) * .0011 * water;',
    '  off.x += sin(time*1.5 + uv.y*140.) * .0008 * water;',
    '  vec3 c = texture2D(tex, uv + off).rgb;',
    /* šilta šviesa: ryškiai oranžinės vietos (langai, krosnelė, žvakės) */
    '  float warm = smoothstep(.16, .3, c.r - c.b) * smoothstep(.45, .72, luma(c));',
    '  float fl = .5*sin(time*7.3) + .3*sin(time*13.1 + 1.3) + .2*sin(time*23.7 + 2.1);',
    '  c *= 1. + warm * (.1 * fl + .05 * sin(time * .8));',
    '  gl_FragColor = vec4(c, 1.);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { return null; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uTime = gl.getUniformLocation(prog, 'time');
  var uDome = gl.getUniformLocation(prog, 'dome');
  var uTree = gl.getUniformLocation(prog, 'treeAmt');

  // kupolo ribos kadre [laikas, x0, y0, x1, y1] – kad karkasas „neplauktų“ kartu su medžiais
  var DOME = [
    [0.0, 0.53, 0.43, 0.70, 0.69], [0.5, 0.53, 0.42, 0.71, 0.70], [1.0, 0.52, 0.40, 0.76, 0.72],
    [1.5, 0.50, 0.37, 0.79, 0.74], [2.0, 0.46, 0.33, 0.83, 0.75], [2.5, 0.44, 0.25, 0.90, 0.78],
    [3.0, 0.40, 0.15, 0.94, 0.85], [3.5, 0.32, 0.00, 1.02, 0.95], [4.0, 0.08, -0.05, 1.05, 1.05]
  ];
  function lerpTrack(track, t) {
    if (t <= track[0][0]) return track[0];
    for (var i = 1; i < track.length; i++) {
      if (t <= track[i][0]) {
        var a = track[i - 1], b = track[i], k = (t - a[0]) / (b[0] - a[0]);
        return a.map(function (v, j) { return v + (b[j] - v) * k; });
      }
    }
    return track[track.length - 1];
  }

  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  /* ---------- garai ---------- */
  var steam = document.createElement('canvas');
  steam.className = 'kp-steam';
  var sx = steam.getContext('2d');

  // kubilo vanduo kadre (dalimis nuo kadro pločio/aukščio) pagal video laiką
  var TUB = [
    [0.0, 0.512, 0.640, 0.025], [0.5, 0.500, 0.645, 0.028], [1.0, 0.478, 0.653, 0.030],
    [1.5, 0.447, 0.645, 0.034], [2.0, 0.400, 0.660, 0.047], [2.5, 0.334, 0.664, 0.066],
    [3.0, 0.250, 0.667, 0.090], [3.5, 0.123, 0.656, 0.125], [4.0, 0.030, 0.675, 0.150]
  ];
  function tubAt(t) {
    if (t <= TUB[0][0]) return TUB[0];
    for (var i = 1; i < TUB.length; i++) {
      if (t <= TUB[i][0]) {
        var a = TUB[i - 1], b = TUB[i], k = (t - a[0]) / (b[0] - a[0]);
        return [t, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
      }
    }
    return TUB[TUB.length - 1];
  }
  function tubAlpha(t) { return 1 - Math.min(1, Math.max(0, (t - 3.7) / 0.4)); }

  // minkšta garų „dėmė“
  var puff = document.createElement('canvas'); puff.width = puff.height = 64;
  var pg = puff.getContext('2d'), gr = pg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(235,238,240,1)'); gr.addColorStop(.45, 'rgba(235,238,240,.45)'); gr.addColorStop(1, 'rgba(235,238,240,0)');
  pg.fillStyle = gr; pg.fillRect(0, 0, 64, 64);

  var parts = [], last = 0, acc = 0;
  function rand(a, b) { return a + Math.random() * (b - a); }

  function drawSteam(time, vt) {
    var W = steam.width, H = steam.height, dt = Math.min(0.05, time - (last || time)); last = time;
    sx.clearRect(0, 0, W, H);
    var tub = tubAt(vt), vis = tubAlpha(vt);
    if (vis <= 0) { parts.length = 0; return; }
    // nauji kamuoliukai – santykinėmis kubilo koordinatėmis, kad garai „važiuotų“ kartu su kubilu
    acc += dt * 9;
    while (acc > 1) {
      acc--;
      parts.push({ x: rand(-0.55, 0.55), y: rand(-0.25, 0.05), vx: rand(-0.25, 0.05), vy: rand(-0.85, -0.55), age: 0, life: rand(2.6, 4.2), r: rand(0.25, 0.45), s: Math.random() * 6.28 });
    }
    var px = tub[1] * W, py = tub[2] * H, unit = tub[3] * W; // vienetas = kubilo spindulys
    sx.globalCompositeOperation = 'source-over';
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      var k = p.age / p.life;
      p.x += (p.vx + Math.sin(time * 1.3 + p.s) * 0.12) * dt;
      p.y += p.vy * dt;
      var r = unit * (p.r + k * 1.3);
      var a = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.075 * vis;
      sx.globalAlpha = a;
      sx.drawImage(puff, px + p.x * unit - r, py + p.y * unit - r, r * 2, r * 2);
    }
    sx.globalAlpha = 1;
  }

  var ok = true;
  return {
    canvas: canvas,
    steam: steam,
    draw: function (time, vt) {
      if (!ok || video.readyState < 2) return;
      var w = video.videoWidth, h = video.videoHeight;
      if (canvas.width !== w) { canvas.width = steam.width = w; canvas.height = steam.height = h; gl.viewport(0, 0, w, h); }
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      } catch (e) { ok = false; canvas.remove(); steam.remove(); video.classList.remove('is-hidden'); return; }
      gl.uniform1f(uTime, time);
      var d = lerpTrack(DOME, vt);
      gl.uniform4f(uDome, d[1], d[2], d[3], d[4]);
      // viduje (nuo ~3,8 s) medžių beveik nėra – linguavimą išjungiame, lieka tik šviesos mirgėjimas
      gl.uniform1f(uTree, 1 - Math.min(1, Math.max(0, (vt - 3.6) / 0.4)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drawSteam(time, vt);
    }
  };
};
