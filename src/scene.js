import * as THREE from 'three';

const N = 24; // number of scan slices

function hash(i, j, k) {
  const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

function buildVolume() {
  const G = 70;
  const pos = [];
  const tone = [];
  const size = [];
  const slice = [];
  const lesion = { x: 0.28, y: 0.12, z: 0.1, r: 0.2 };
  for (let k = 0; k < N; k++) {
    const z = (k / (N - 1) - 0.5) * 2;
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        const x = (i / (G - 1) - 0.5) * 2;
        const y = (j / (G - 1) - 0.5) * 2;
        const r = Math.sqrt((x / 0.92) ** 2 + (y / 0.78) ** 2 + z ** 2);
        const shell = Math.exp(-(((r - 0.86) / 0.05) ** 2));
        const inner =
          r < 0.8 ? 0.16 * (0.5 + 0.5 * Math.sin(x * 9 + z * 5) * Math.cos(y * 8 - z * 3)) : 0;
        const d = Math.hypot(x - lesion.x, y - lesion.y, z - lesion.z);
        const inL = d < lesion.r;
        const dens =
          Math.max(shell * 0.75, inner) +
          (inL ? 0.8 : 0) +
          (d < lesion.r * 1.35 && !inL ? 0.18 : 0);
        if (hash(i, j, k) < dens) {
          pos.push(x + (hash(j, k, i) - 0.5) * 0.02, y + (hash(k, i, j) - 0.5) * 0.02, z);
          tone.push(inL ? 1 : 0);
          size.push(inL ? 2.6 : shell > 0.3 ? 1.9 : 1.4);
          slice.push(k);
        }
      }
    }
  }
  return { pos, tone, size, slice };
}

const vertexShader = /* glsl */ `
  attribute float aTone; attribute float aSize; attribute float aSlice;
  uniform float uSpread, uScan, uPx, uTime, uBoost, uAspect;
  uniform vec2 uMouse;
  varying float vTone; varying float vGlow;
  void main(){
    vec3 p = position; p.z *= uSpread;
    p += 0.012 * vec3(sin(position.y * 9.0 + uTime * 0.9), sin(position.x * 8.0 + uTime * 0.7), sin(position.z * 7.0 + uTime * 0.8));
    float s = abs(aSlice - uScan);
    vGlow = exp(-s * s * 0.5);
    vTone = aTone;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = ndc - uMouse;
    float dist = length(d * vec2(uAspect, 1.0));
    clip.xy += normalize(d + 1e-4) * exp(-dist * dist * 16.0) * 0.07 * clip.w;
    float pulse = 1.0 + aTone * (0.22 * sin(uTime * 2.0) + uBoost * 0.9);
    gl_PointSize = aSize * uPx * (1.0 + vGlow * 0.9) * pulse * (3.2 / -mv.z) * 1.9;
    gl_Position = clip;
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase, uAccent; uniform float uDim, uAlpha, uBoost;
  varying float vTone; varying float vGlow;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uBase, uAccent, vTone);
    float k = (0.34 + vGlow * 0.6 + vTone * (0.45 + uBoost * 0.9)) * uDim * uAlpha;
    gl_FragColor = vec4(col, a * k);
  }`;

export function initScene(state) {
  const total = document.getElementById('hudTotal');
  const hudSlice = document.getElementById('hudSlice');
  const hudSection = document.getElementById('hudSection');
  total.textContent = N;

  const secs = [...document.querySelectorAll('section[data-label]')];
  const currentLabel = () => {
    const y = window.innerHeight * 0.4;
    let label = secs[0].dataset.label;
    secs.forEach((s) => {
      if (s.getBoundingClientRect().top <= y) label = s.dataset.label;
    });
    return label;
  };

  const canvas = document.getElementById('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    document.body.classList.add('fallback');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0b0a09, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  const rig = new THREE.Group();
  scene.add(rig);

  const v = buildVolume();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v.pos, 3));
  geo.setAttribute('aTone', new THREE.Float32BufferAttribute(v.tone, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(v.size, 1));
  geo.setAttribute('aSlice', new THREE.Float32BufferAttribute(v.slice, 1));
  const uniforms = {
    uSpread: { value: 0.7 },
    uScan: { value: 0 },
    uPx: { value: renderer.getPixelRatio() },
    uTime: { value: 0 },
    uBoost: { value: 0 },
    uAspect: { value: 1 },
    uAlpha: { value: 1 },
    uDim: { value: 1 },
    uMouse: { value: new THREE.Vector2(10, 10) },
    uBase: { value: new THREE.Color(0xcfc8bc) },
    uAccent: { value: new THREE.Color(0x7fd6c6) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  rig.add(new THREE.Points(geo, mat));

  const frameGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.05, -0.9, 0),
    new THREE.Vector3(1.05, -0.9, 0),
    new THREE.Vector3(1.05, 0.9, 0),
    new THREE.Vector3(-1.05, 0.9, 0),
  ]);
  const frames = [];
  for (let f = 0; f < N; f += 4) {
    const ln = new THREE.LineLoop(
      frameGeo,
      new THREE.LineBasicMaterial({
        color: 0xece7df,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      }),
    );
    ln.userData.z = (f / (N - 1) - 0.5) * 2;
    rig.add(ln);
    frames.push(ln);
  }
  const scanMat = new THREE.LineBasicMaterial({
    color: 0x7fd6c6,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const scanFrame = new THREE.LineLoop(frameGeo, scanMat);
  rig.add(scanFrame);

  let W = 0;
  let H = 0;
  let wide = true;
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    wide = W > 900;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.set(0, 0, wide ? 4.6 : W / H < 0.8 ? 5.6 : 4.8);
    camera.updateProjectionMatrix();
    uniforms.uPx.value = renderer.getPixelRatio();
    uniforms.uAspect.value = W / H;
    uniforms.uDim.value = wide ? 1 : 0.55;
  };
  window.addEventListener('resize', resize);
  resize();

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let tmx = 0;
  let tmy = 0;
  let mx = 0;
  let my = 0;
  let prog = 0;
  let tprog = 0;
  let extraY = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      tmx = (e.clientX / W - 0.5) * 2;
      tmy = (e.clientY / H - 0.5) * 2;
    },
    { passive: true },
  );
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    tprog = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  prog = tprog;

  const t0 = performance.now();
  let lastHud = -1;
  let lastLabel = '';
  let lastLabelCheck = 0;
  const frame = (now) => {
    const t = (now - t0) / 1000;
    prog += (tprog - prog) * (reduce ? 1 : 0.06);
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;
    extraY = extraY * 0.96 + (reduce ? 0 : (state.velocity || 0) * 0.0016);

    const intro = state.intro.v;
    const spread = (0.55 + Math.sin(prog * Math.PI) * 1.15) * (0.12 + 0.88 * intro);
    uniforms.uSpread.value = spread;
    uniforms.uAlpha.value = intro;
    uniforms.uTime.value = reduce ? 0 : t;
    uniforms.uBoost.value = state.boost;
    if (fine && !reduce) uniforms.uMouse.value.set(mx * 1.0, -my * 1.0);
    const scan = prog * (N - 1);
    uniforms.uScan.value = scan;

    rig.rotation.y =
      -0.55 +
      prog * Math.PI * 1.35 +
      mx * 0.25 +
      (reduce ? 0 : t * 0.05) +
      extraY -
      (1 - intro) * 1.4;
    rig.rotation.x = 0.18 + my * 0.12 + Math.sin(prog * Math.PI) * 0.18;
    rig.position.x = wide ? 1.05 : 0;
    rig.position.y = wide ? 0 : 0.9 - prog * 0.4;
    rig.scale.setScalar((wide ? 1 : 0.9) * (0.88 + 0.12 * intro));

    scanFrame.position.z = (scan / (N - 1) - 0.5) * 2 * spread;
    scanMat.opacity = 0.7 * intro;
    frames.forEach((l) => {
      l.position.z = l.userData.z * spread;
    });

    renderer.render(scene, camera);

    const idx = Math.round(scan) + 1;
    if (idx !== lastHud) {
      hudSlice.textContent = (idx < 10 ? '0' : '') + idx;
      lastHud = idx;
    }
    if (now - lastLabelCheck > 150) {
      lastLabelCheck = now;
      const lab = currentLabel();
      if (lab !== lastLabel) {
        hudSection.textContent = lab;
        lastLabel = lab;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
