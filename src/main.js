import * as THREE from 'three';
import './style.css';

(function () {
  var N = 24;                                   // number of scan slices
  document.getElementById('hudTotal').textContent = N;
  var hudSlice = document.getElementById('hudSlice');
  var hudSection = document.getElementById('hudSection');

  // copy email
  var copyBtn = document.getElementById('copy');
  copyBtn.addEventListener('click', function () {
    var t = document.getElementById('email').textContent;
    function done() { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600); }
    function fallback() {
      var r = document.createRange(); r.selectNodeContents(document.getElementById('email'));
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      copyBtn.textContent = 'Press Ctrl/Cmd+C';
    }
    try { navigator.clipboard.writeText(t).then(done, fallback); } catch { fallback(); }
  });

  // section label for HUD
  var secs = Array.prototype.slice.call(document.querySelectorAll('section[data-label]'));
  function currentLabel() {
    var y = window.innerHeight * 0.4, label = secs[0].dataset.label;
    secs.forEach(function (s) { if (s.getBoundingClientRect().top <= y) label = s.dataset.label; });
    return label;
  }

  if (typeof THREE === 'undefined') { document.body.classList.add('fallback'); return; }
  var canvas = document.getElementById('scene'), renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch { document.body.classList.add('fallback'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0b0a09, 1);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);
  var rig = new THREE.Group(); scene.add(rig);

  // --- synthetic scan volume ---
  function hash(i, j, k) { var h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); }
  var G = 70, pos = [], tone = [], size = [], slice = [];
  var lesion = { x: 0.28, y: 0.12, z: 0.1, r: 0.2 };
  for (var k = 0; k < N; k++) {
    var z = (k / (N - 1) - 0.5) * 2;
    for (var i = 0; i < G; i++) for (var j = 0; j < G; j++) {
      var x = (i / (G - 1) - 0.5) * 2, y = (j / (G - 1) - 0.5) * 2;
      var r = Math.sqrt(Math.pow(x / 0.92, 2) + Math.pow(y / 0.78, 2) + Math.pow(z / 1.0, 2));
      var shell = Math.exp(-Math.pow((r - 0.86) / 0.05, 2));
      var inner = r < 0.8 ? 0.16 * (0.5 + 0.5 * Math.sin(x * 9 + z * 5) * Math.cos(y * 8 - z * 3)) : 0;
      var dx = x - lesion.x, dy = y - lesion.y, dz = z - lesion.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var inL = d < lesion.r;
      var dens = Math.max(shell * 0.75, inner) + (inL ? 0.8 : 0) + (d < lesion.r * 1.35 && !inL ? 0.18 : 0);
      if (hash(i, j, k) < dens) {
        pos.push(x + (hash(j, k, i) - .5) * 0.02, y + (hash(k, i, j) - .5) * 0.02, z);
        tone.push(inL ? 1 : 0);
        size.push(inL ? 2.6 : (shell > 0.3 ? 1.9 : 1.4));
        slice.push(k);
      }
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('aSlice', new THREE.Float32BufferAttribute(slice, 1));
  var uniforms = {
    uSpread: { value: 0.7 }, uScan: { value: 0 }, uPx: { value: renderer.getPixelRatio() },
    uBase: { value: new THREE.Color(0xcfc8bc) }, uAccent: { value: new THREE.Color(0x7fd6c6) }, uDim: { value: 1 }
  };
  var mat = new THREE.ShaderMaterial({
    uniforms: uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute float aTone; attribute float aSize; attribute float aSlice;',
      'uniform float uSpread, uScan, uPx; varying float vTone; varying float vGlow;',
      'void main(){',
      '  vec3 p = position; p.z *= uSpread;',
      '  float s = abs(aSlice - uScan);',
      '  vGlow = exp(-s * s * 0.5);',
      '  vTone = aTone;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = aSize * uPx * (1.0 + vGlow * 0.9) * (3.2 / -mv.z) * 1.9;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uBase, uAccent; uniform float uDim; varying float vTone; varying float vGlow;',
      'void main(){',
      '  vec2 c = gl_PointCoord - 0.5; float d = length(c);',
      '  if (d > 0.5) discard;',
      '  float a = smoothstep(0.5, 0.0, d);',
      '  vec3 col = mix(uBase, uAccent, vTone);',
      '  float k = (0.34 + vGlow * 0.6 + vTone * 0.45) * uDim;',
      '  gl_FragColor = vec4(col, a * k);',
      '}'
    ].join('\n')
  });
  var cloud = new THREE.Points(geo, mat);
  rig.add(cloud);

  // scan-plane frames: faint outlines every 4th slice + one bright moving plane
  var frameGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.05, -0.9, 0), new THREE.Vector3(1.05, -0.9, 0), new THREE.Vector3(1.05, 0.9, 0), new THREE.Vector3(-1.05, 0.9, 0)
  ]);
  var frames = [];
  for (var f = 0; f < N; f += 4) {
    var ln = new THREE.LineLoop(frameGeo, new THREE.LineBasicMaterial({ color: 0xece7df, transparent: true, opacity: 0.09, depthWrite: false }));
    ln.userData.z = (f / (N - 1) - 0.5) * 2; rig.add(ln); frames.push(ln);
  }
  var scanFrame = new THREE.LineLoop(frameGeo, new THREE.LineBasicMaterial({ color: 0x7fd6c6, transparent: true, opacity: 0.7, depthWrite: false }));
  rig.add(scanFrame);

  // --- sizing ---
  var W = 0, H = 0, wide = true;
  function resize() {
    W = window.innerWidth; H = window.innerHeight; wide = W > 900;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.z = wide ? 4.6 : (W / H < 0.8 ? 5.6 : 4.8);
    camera.updateProjectionMatrix();
    uniforms.uPx.value = renderer.getPixelRatio();
    uniforms.uDim.value = wide ? 1 : 0.55;
  }
  window.addEventListener('resize', resize); resize();

  // --- interaction state ---
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mx = 0, my = 0, tmx = 0, tmy = 0, prog = 0, tprog = 0;
  window.addEventListener('pointermove', function (e) { tmx = (e.clientX / W - 0.5) * 2; tmy = (e.clientY / H - 0.5) * 2; }, { passive: true });
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    tprog = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); prog = tprog;

  var t0 = performance.now(), lastHud = -1, lastLabel = '';
  function frame(now) {
    var t = (now - t0) / 1000;
    prog += (tprog - prog) * (reduce ? 1 : 0.06);
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;

    // scroll choreography: rotate, spread slices apart in the middle, close up again at the end
    var spread = 0.55 + Math.sin(prog * Math.PI) * 1.15;
    uniforms.uSpread.value = spread;
    var scan = prog * (N - 1);
    uniforms.uScan.value = scan;
    var auto = reduce ? 0 : t * 0.05;
    rig.rotation.y = -0.55 + prog * Math.PI * 1.35 + mx * 0.25 + auto;
    rig.rotation.x = 0.18 + my * 0.12 + Math.sin(prog * Math.PI) * 0.18;
    rig.position.x = wide ? 1.05 : 0;
    rig.position.y = wide ? 0 : 0.9 - prog * 0.4;
    rig.scale.setScalar(wide ? 1 : 0.9);

    var sz = (scan / (N - 1) - 0.5) * 2 * spread;
    scanFrame.position.z = sz;
    frames.forEach(function (l) { l.position.z = l.userData.z * spread; });

    renderer.render(scene, camera);

    var idx = Math.round(scan) + 1;
    if (idx !== lastHud) { hudSlice.textContent = (idx < 10 ? '0' : '') + idx; lastHud = idx; }
    var lab = currentLabel();
    if (lab !== lastLabel) { hudSection.textContent = lab; lastLabel = lab; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
