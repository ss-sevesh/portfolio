import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = (sel, root = document) => [...root.querySelectorAll(sel)];

function wordsMasked(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  return text.split(/\s+/).map((w) => {
    const outer = document.createElement('span');
    outer.className = 'mask';
    outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.textContent = w;
    outer.appendChild(inner);
    el.appendChild(outer);
    el.appendChild(document.createTextNode(' '));
    return inner;
  });
}

function charsMasked(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const chars = [];
  text.split(' ').forEach((word, wi, arr) => {
    const outer = document.createElement('span');
    outer.className = 'mask';
    outer.setAttribute('aria-hidden', 'true');
    [...word].forEach((c) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      outer.appendChild(s);
      chars.push(s);
    });
    el.appendChild(outer);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return chars;
}

function wordsPlain(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  return text.split(/\s+/).map((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.setAttribute('aria-hidden', 'true');
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    return s;
  });
}

export function initMotion(state) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // copy email (works with or without motion)
  const copyBtn = document.getElementById('copy');
  copyBtn.addEventListener('click', () => {
    const el = document.getElementById('email');
    const done = () => {
      copyBtn.textContent = 'Copied';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1600);
    };
    const fallback = () => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      copyBtn.textContent = 'Press Ctrl/Cmd+C';
    };
    try {
      navigator.clipboard.writeText(el.textContent).then(done, fallback);
    } catch {
      fallback();
    }
  });

  if (reduce) return; // everything stays visible and static

  // smooth scrolling, driven by the GSAP ticker so ScrollTrigger stays in sync
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  document.documentElement.classList.add('has-lenis');
  lenis.on('scroll', (e) => {
    ScrollTrigger.update();
    state.velocity = e.velocity;
  });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  $('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, {
        offset: a.getAttribute('href') === '#top' ? 0 : -40,
        duration: 1.4,
      });
    }),
  );

  // scroll progress + active nav link
  gsap.to('.progress i', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.2 },
  });
  $('section[id]').forEach((s) => {
    const link = document.querySelector(`.links a[href="#${s.id}"]`);
    if (!link) return;
    ScrollTrigger.create({
      trigger: s,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => link.classList.toggle('active', self.isActive),
    });
  });

  // ---- hero intro ----
  const h1 = document.querySelector('#top h1');
  const chars = charsMasked(h1);
  const countEl = document.querySelector('[data-count]');
  const target = parseFloat(countEl.dataset.count);
  const dec = parseInt(countEl.dataset.dec, 10);
  const counter = { v: 0 };
  state.intro.v = 0;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to(state.intro, { v: 1, duration: 2.6, ease: 'power3.out' }, 0)
    .from('nav', { y: -30, opacity: 0, duration: 1 }, 0.3)
    .from('#top .eyebrow', { y: 20, opacity: 0, duration: 0.9 }, 0.3)
    .from(chars, { yPercent: 118, rotate: 6, duration: 1.4, stagger: 0.05 }, 0.35)
    .from('#top .lede, #top .role', { y: 28, opacity: 0, duration: 1.1, stagger: 0.12 }, 0.9)
    .from('#top .cta .btn', { y: 22, opacity: 0, duration: 0.9, stagger: 0.08 }, 1.1)
    .from('#top .stat', { y: 44, opacity: 0, duration: 1.1, stagger: 0.1 }, 1.2)
    .from('.cue', { opacity: 0, duration: 1 }, 1.8)
    .to(
      counter,
      {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => (countEl.textContent = counter.v.toFixed(dec)),
      },
      1.3,
    );
  countEl.textContent = (0).toFixed(dec);

  // ---- section headings and eyebrows ----
  $('section:not(#top) h2').forEach((h) => {
    const words = wordsMasked(h);
    gsap.from(words, {
      yPercent: 115,
      rotate: 4,
      duration: 1.2,
      stagger: 0.07,
      ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 88%', once: true },
    });
  });
  $('section:not(#top) .eyebrow').forEach((e) =>
    gsap.from(e, {
      y: 16,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: e, start: 'top 92%', once: true },
    }),
  );

  // ---- scrubbed paragraph: words light up as you scroll ----
  $('.scrub').forEach((p) => {
    const words = wordsPlain(p);
    gsap.set(words, { opacity: 0.16 });
    gsap.to(words, {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
  });

  // ---- batched reveals ----
  const batchTargets =
    '.job, .proj, .skill, .exp a, .rec > div, .facts div, #about .scrub + p, #contact .lead2, #contact .mail, #contact .contact-links';
  gsap.set(batchTargets, { y: 60, opacity: 0 });
  ScrollTrigger.batch(batchTargets, {
    start: 'top 92%',
    once: true,
    onEnter: (els) =>
      gsap.to(els, {
        y: 0,
        opacity: 1,
        duration: 1.1,
        stagger: 0.1,
        ease: 'expo.out',
        overwrite: true,
      }),
  });
  $('.skill').forEach((sk) =>
    ScrollTrigger.create({
      trigger: sk,
      start: 'top 85%',
      once: true,
      onEnter: () =>
        gsap.from($('.chip', sk), {
          opacity: 0,
          y: 14,
          duration: 0.7,
          stagger: 0.035,
          ease: 'power3.out',
        }),
    }),
  );
  $('.proj').forEach((card) =>
    ScrollTrigger.create({
      trigger: card,
      start: 'top 85%',
      once: true,
      onEnter: () =>
        gsap.from($('.chip', card), {
          opacity: 0,
          x: -10,
          duration: 0.6,
          stagger: 0.05,
          delay: 0.3,
          ease: 'power3.out',
        }),
    }),
  );

  // timeline line draws with scroll; polyp bar fills when visible
  gsap.fromTo(
    '.job .draw',
    { scaleY: 0 },
    {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.job', start: 'top 75%', end: 'bottom 55%', scrub: true },
    },
  );
  gsap.from('.bar .after', {
    scaleX: 0,
    transformOrigin: '0 50%',
    duration: 1.6,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.bar', start: 'top 90%', once: true },
  });

  // ---- marquee reacts to scroll speed ----
  const track = document.querySelector('.marquee .track');
  [...track.children].forEach((c) => track.appendChild(c.cloneNode(true)));
  [...track.children]
    .slice(0, track.children.length / 2)
    .forEach((c) => track.appendChild(c.cloneNode(true)));
  let x = 0;
  gsap.ticker.add((_, dt) => {
    const v = state.velocity || 0;
    x -= (0.7 + Math.min(Math.abs(v), 60) * 0.35) * (dt / 16.7);
    const loop = track.scrollWidth / 4;
    if (loop > 0 && x <= -loop) x += loop;
    const skew = gsap.utils.clamp(-8, 8, -v * 0.12);
    track.style.transform = `translate3d(${x}px,0,0) skewX(${skew}deg)`;
  });

  if (!fine) return;

  // ---- custom cursor ----
  const cursor = document.querySelector('.cursor');
  const dot = cursor.querySelector('.dot');
  const ring = cursor.querySelector('.ring');
  document.documentElement.classList.add('has-cursor');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  window.addEventListener(
    'pointermove',
    (e) => {
      cursor.classList.add('on');
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    },
    { passive: true },
  );
  const hoverSel = 'a, button, .proj';
  document.addEventListener('pointerover', (e) =>
    cursor.classList.toggle('is-hover', !!e.target.closest(hoverSel)),
  );

  // ---- magnetic buttons ----
  $('.btn, .gh, .mark').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.3);
      my((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener('pointerleave', () => {
      mx(0);
      my(0);
    });
  });

  // ---- project cards: 3D tilt, spotlight, and the scene's segmented region lights up ----
  $('.proj').forEach((card) => {
    const rX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const rY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      rY((px - 0.5) * 8);
      rX(-(py - 0.5) * 8);
    });
    card.addEventListener('pointerenter', () => gsap.to(state, { boost: 1, duration: 0.6 }));
    card.addEventListener('pointerleave', () => {
      rX(0);
      rY(0);
      gsap.to(state, { boost: 0, duration: 0.8 });
    });
  });
}
