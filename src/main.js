import './style.css';
import { initScene } from './scene.js';
import { initMotion } from './motion.js';

// Shared state between the WebGL scene and the scroll/motion layer.
const state = { intro: { v: 1 }, velocity: 0, boost: 0 };

initScene(state);
initMotion(state);
