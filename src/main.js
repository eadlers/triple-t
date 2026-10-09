import * as THREE from 'three';
import { World, WALL_H } from './world.js';
import { AVATARS, buildAvatar, poseAvatar } from './avatars.js';
import { Tung, buildTung, aimEyes, TUNG_FACE_Y } from './tung.js';
import { GameAudio } from './audio.js';
import { LiCutscene } from './cutscene.js';
import { wallTexture, carpetTexture, ceilingTexture, grainDataURL } from './textures.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const FOG = 0x3d3519;
const WALK = 4.0, SPRINT = 7.2;
const CAM_DIST = 3.2, SHOULDER = 0.45, PIVOT_Y = 1.55;
const SENS = 0.0023;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
const baseFov = () => (window.innerWidth < window.innerHeight ? 82 : 70);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 90);
const audio = new GameAudio();

$('grain').style.background = `url(${grainDataURL()})`;

// ---------- persistence ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const getBest = () => parseFloat(store.get('tripleT.best')) || 0;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const TUNG_CALL = 'Tung tung tung tung tung tung tung tung tung sahur!';
const DEATH_TITLES = ['TE ATRAPÓ', 'TRIPLE T TE ENCONTRÓ', 'TE HICIERON SAHUR', 'TE AGARRARON DESPREVENIDO', 'DESPERTASTE PARA EL SAHUR'];
const RANKS = [
  [30, 'Dormilón'], [60, 'Se saltó el sahur'], [120, 'Turista de los Backrooms'],
  [240, 'Corredor profesional'], [480, 'Certificado por Naruto'], [Infinity, 'La peor pesadilla de Triple T'],
];
const rankFor = (t) => RANKS.find(([max]) => t < max)[1];

let selected = AVATARS.find((a) => a.id === store.get('tripleT.avatar')) || AVATARS[0];
let mode = 'menu'; // menu | playing | paused | caught | over
let game = null;
let time = 0;
let yaw = 0, pitch = 0.22;

// ---------- menu scene ----------
const menu = buildMenuScene();

function buildMenuScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 5, 15);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  cam.position.set(-1.25, 1.35, 4.2);
  cam.lookAt(-1.25, 1.0, 0);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: carpetTexture(15), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: ceilingTexture(15), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = WALL_H;
  scene.add(ceil);

  // Back wall with a dark doorway where Tung lurks.
  const wallMat = (w) => {
    const t = wallTexture();
    t.repeat.set(w, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
  };
  const segs = [[-12, 1.6], [3.4, 14]];
  for (const [a, b] of segs) {
    const w = b - a;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, 0.3), wallMat(w));
    m.position.set((a + b) / 2, WALL_H / 2, -4);
    scene.add(m);
  }
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, WALL_H, 6), wallMat(6));
  side.position.set(-5.5, WALL_H / 2, -1);
  scene.add(side);

  for (const [x, z] of [[0, 0.5], [-3, 2], [2.5, -9]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.6, 1.3) }));
    p.position.set(x, WALL_H - 0.02, z);
    scene.add(p);
  }
  scene.add(new THREE.HemisphereLight(0xfff3c4, 0x5a4a20, 0.8));
  const key = new THREE.PointLight(0xfff0c8, 14, 12, 1.6);
  key.position.set(0, 2.75, 1.2);
  scene.add(key);
  const rim = new THREE.PointLight(0xffd890, 4, 8, 1.6);
  rim.position.set(2.5, 2.6, -2.5);
  scene.add(rim);

  const tung = buildTung();
  tung.root.position.set(4.6, 0, -6.5);
  scene.add(tung.root);

  return { scene, cam, tung, av: null };
}

function setMenuAvatar(cfg) {
  if (menu.av) {
    menu.scene.remove(menu.av.root);
    disposeTree(menu.av.root);
  }
  menu.av = buildAvatar(cfg);
  menu.av.root.rotation.y = 0.5;
  menu.scene.add(menu.av.root);
}

function updateMenu(dt) {
  poseAvatar(menu.av, 0, 0, 0, time);
  if (menu.freeze) return;
  menu.av.root.rotation.y += dt * 0.55;
  // Tung slowly leans into the doorway, stares, and slides away again.
  const c = (time % 11) / 11;
  const out = THREE.MathUtils.smoothstep(c, 0.25, 0.4) * (1 - THREE.MathUtils.smoothstep(c, 0.75, 0.9));
  menu.tung.root.position.x = 4.6 - out * 2.1;
  menu.tung.root.rotation.y = 0.15;
  menu.tung.rig.rotation.z = out * -0.12;
  aimEyes(menu.tung, menu.cam.position.x, menu.cam.position.y, menu.cam.position.z);
}

// ---------- avatar cards ----------
function renderCards() {
  const wrap = $('avatarCards');
  wrap.innerHTML = '';
  for (const cfg of AVATARS) {
    const b = document.createElement('button');
    b.className = 'card' + (cfg.id === selected.id ? ' selected' : '');
    b.innerHTML = `
      <span class="swatch" style="background: linear-gradient(160deg, ${cfg.hair} 0 38%, ${cfg.skin} 38% 62%, ${cfg.topColor} 62%)"></span>
      <span><div class="name">${cfg.name}</div><div class="tag">${cfg.tagline}</div></span>`;
    b.addEventListener('click', () => {
      selected = cfg;
      store.set('tripleT.avatar', cfg.id);
      setMenuAvatar(cfg);
      renderCards();
    });
    wrap.appendChild(b);
  }
  const best = getBest();
  $('best').textContent = best > 0 ? `Mejor tiempo: ${fmt(best)}` : '';
}

// ---------- game lifecycle ----------
function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.map?.dispose();
      m.dispose();
    }
  });
}

function disposeGame() {
  if (!game) return;
  disposeTree(game.scene);
  game = null;
}

let introTimer;
function startGame() {
  audio.init();
  disposeGame();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 3, 30);
  const world = new World(scene, { size: 34 });
  const av = buildAvatar(selected);
  scene.add(av.root);
  const c = world.cellCenter(world.randomCell());
  const player = {
    pos: new THREE.Vector3(c.x, 0, c.z), vel: new THREE.Vector3(), facing: 0,
    phase: 0, moving: false, sprinting: false,
  };
  const tung = new Tung(world, scene);
  tung.spawnAwayFrom(player.pos);
  world.onZap = (d) => audio.zap(d);
  game = {
    scene, world, av, player, tung, elapsed: 0, knockTimer: 3, caughtT: 0, hitDone: false, camT: 1, alertTimer: 0,
    stats: { distance: 0, closeCalls: 0 },
    chaseLineTimer: 4, closeCall: false,
  };
  yaw = Math.random() * Math.PI * 2;
  pitch = 0.22;
  camera.fov = baseFov();
  camera.updateProjectionMatrix();

  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('jumpscare').classList.add('hidden');
  hideBubble();
  $('hud').classList.remove('hidden');
  // The hunt starts immediately.
  setAlert('TUNG TUNG TUNG SAHUR', true);
  game.alertTimer = 3.5;
  audio.startChaseMusic();
  audio.alert();
  audio.speak(TUNG_CALL);
  world.globalFlicker = 0.8;
  const intro = $('intro');
  intro.classList.add('show');
  const hint = $('touchHint');
  hint.classList.add('show');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => intro.classList.remove('show'), 3500);
  setTimeout(() => hint.classList.remove('show'), 7000);
  releaseTouches();

  mode = 'playing';
  audio.setHum(1);
  lockPointer();
}

function toMenu() {
  audio.silence();
  audio.resumeAll();
  disposeGame();
  mode = 'menu';
  $('hud').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('jumpscare').classList.add('hidden');
  $('danger').style.opacity = 0;
  hideBubble();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('menu').classList.remove('hidden');
  renderCards();
  if (document.pointerLockElement) document.exitPointerLock();
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  releaseTouches();
  $('pause').classList.remove('hidden');
  audio.pauseAll();
  if (document.pointerLockElement) document.exitPointerLock();
}

function resume() {
  if (mode !== 'paused') return;
  mode = 'playing';
  $('pause').classList.add('hidden');
  audio.resumeAll();
  lockPointer();
}

function lockPointer() {
  if (isTouch()) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* pointer lock unavailable: drag-to-look fallback */ }
}

// Speech bubble over the player's head.
const bubble = { el: $('bubble'), until: 0, delayed: null };
function say(text, { panic = false, delay = 0, duration = 2.6 } = {}) {
  clearTimeout(bubble.delayed);
  bubble.delayed = setTimeout(() => {
    bubble.el.textContent = text;
    bubble.el.classList.toggle('panic', panic);
    bubble.el.classList.remove('hidden');
    bubble.until = time + duration;
  }, delay * 1000);
}
function hideBubble() {
  clearTimeout(bubble.delayed);
  bubble.el.classList.add('hidden');
  bubble.until = 0;
}
const _head = new THREE.Vector3();
function placeBubble() {
  if (bubble.until && time > bubble.until) hideBubble();
  if (bubble.el.classList.contains('hidden') || !game) return;
  _head.set(game.player.pos.x, 2.15, game.player.pos.z).project(camera);
  if (_head.z > 1) return;
  bubble.el.style.left = `${(_head.x * 0.5 + 0.5) * window.innerWidth}px`;
  bubble.el.style.top = `${(-_head.y * 0.5 + 0.5) * window.innerHeight}px`;
}

function setAlert(text, pulse = false) {
  const a = $('alert');
  a.textContent = text;
  a.classList.toggle('pulse', pulse);
}

// ---------- input ----------
const keys = {};
let dragging = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (mode === 'menu' && e.code === 'Enter') startGame();
  if (mode === 'playing' && e.code === 'KeyP') pause();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
});
canvas.addEventListener('mousedown', () => {
  dragging = true;
  if (mode === 'playing' && !document.pointerLockElement) lockPointer();
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (mode !== 'playing') return;
  if (document.pointerLockElement !== canvas && !dragging) return;
  yaw -= e.movementX * SENS;
  pitch = THREE.MathUtils.clamp(pitch + e.movementY * SENS, -0.35, 1.0);
});
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && hadLock && mode === 'playing') pause();
  hadLock = locked;
});

// ---------- touch controls ----------
// Left half: a floating joystick (push it all the way to Naruto run). Right half: drag to look.
const STICK_R = 60, TOUCH_SENS = 0.006;
const touch = { x: 0, y: 0, mag: 0, stickId: null, lookId: null, ox: 0, oy: 0, lx: 0, ly: 0 };
const isTouch = () => document.body.classList.contains('touch');
if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

function releaseTouches() {
  touch.stickId = touch.lookId = null;
  touch.x = touch.y = touch.mag = 0;
  $('stick').classList.remove('active');
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  document.body.classList.add('touch');
  e.preventDefault();
  if (mode !== 'playing') return;
  if (e.clientX < window.innerWidth * 0.45 && touch.stickId === null) {
    touch.stickId = e.pointerId;
    touch.ox = e.clientX;
    touch.oy = e.clientY;
    const st = $('stick');
    st.style.left = `${e.clientX}px`;
    st.style.top = `${e.clientY}px`;
    st.classList.add('active');
    $('knob').style.transform = 'translate(-50%, -50%)';
  } else if (touch.lookId === null) {
    touch.lookId = e.pointerId;
    touch.lx = e.clientX;
    touch.ly = e.clientY;
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === touch.stickId) {
    let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      dx *= STICK_R / d;
      dy *= STICK_R / d;
    }
    touch.x = dx / STICK_R;
    touch.y = dy / STICK_R;
    touch.mag = Math.min(1, d / STICK_R);
    $('knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  } else if (e.pointerId === touch.lookId && mode === 'playing') {
    yaw -= (e.clientX - touch.lx) * TOUCH_SENS;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - touch.ly) * TOUCH_SENS, -0.35, 1.0);
    touch.lx = e.clientX;
    touch.ly = e.clientY;
  }
});
const endTouch = (e) => {
  if (e.pointerId === touch.stickId) {
    touch.stickId = null;
    touch.x = touch.y = touch.mag = 0;
    $('stick').classList.remove('active');
  }
  if (e.pointerId === touch.lookId) touch.lookId = null;
};
window.addEventListener('pointerup', endTouch);
window.addEventListener('pointercancel', endTouch);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
$('pauseBtn').addEventListener('click', pause);

$('playBtn').addEventListener('click', startGame);
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', toMenu);
$('retryBtn').addEventListener('click', startGame);
$('menuBtn').addEventListener('click', toMenu);

// ---------- game update ----------
const _shoulder = new THREE.Vector3();

function updateGame(dt) {
  const g = game, p = g.player, w = g.world;
  g.elapsed += dt;

  // Movement relative to the camera
  const stickOn = touch.mag > 0.15;
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - (stickOn ? touch.y : 0);
  const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (stickOn ? touch.x : 0);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = fx * fwd + rx * str, mz = fz * fwd + rz * str;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx /= ml; mz /= ml; }

  p.sprinting = (keys.ShiftLeft || keys.ShiftRight || touch.mag > 0.65) && ml > 0;
  const speed = ml > 0 ? (p.sprinting ? SPRINT : WALK) : 0;
  const k = 1 - Math.exp(-dt * 12);
  p.vel.x += (mx * speed - p.vel.x) * k;
  p.vel.z += (mz * speed - p.vel.z) * k;
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;
  w.collide(p.pos, 0.35);
  const hs = Math.hypot(p.vel.x, p.vel.z);
  p.moving = hs > 0.5;
  g.stats.distance += hs * dt;
  if (hs > 0.3) {
    let d = Math.atan2(p.vel.x, p.vel.z) - p.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.facing += d * (1 - Math.exp(-dt * 14));
  }
  const prev = p.phase;
  p.phase += hs * dt * 2.4;
  if (Math.floor(p.phase / Math.PI) !== Math.floor(prev / Math.PI)) audio.step(p.sprinting);
  g.av.root.position.copy(p.pos);
  g.av.root.rotation.y = p.facing;
  poseAvatar(g.av, p.phase, Math.min(1, hs / WALK), THREE.MathUtils.clamp((hs - WALK) / (SPRINT - WALK), 0, 1), time);

  // Tung
  const t = g.tung;
  const ev = t.update(dt, p);
  const lines = selected.lines;
  if (ev.caught) {
    startJumpscare();
    return;
  }

  // Close calls: he gets within a few meters and you pull away again.
  if (t.dist < 3.5) g.closeCall = true;
  else if (g.closeCall && t.dist > 9) {
    g.closeCall = false;
    g.stats.closeCalls++;
    say(pick(lines.escape), { delay: 0.2 });
    g.chaseLineTimer = 5;
  }

  // Your character narrates: calm-ish when he's far, panicking when he's near.
  g.chaseLineTimer -= dt;
  if (g.chaseLineTimer <= 0) {
    g.chaseLineTimer = 6 + Math.random() * 3;
    if (t.dist < 18) say(pick(lines.chase), { panic: true });
    else say(pick(lines.idle), { duration: 3.2 });
  }

  if (g.alertTimer > 0) {
    g.alertTimer -= dt;
    if (g.alertTimer <= 0) setAlert('');
  }
  g.knockTimer -= dt;
  if (g.knockTimer <= 0) {
    audio.knocks(3, 0.16);
    g.knockTimer = 1.4 + Math.random() * 0.6;
  }

  w.updateLights(dt, p.pos.x, p.pos.z);
  audio.setHum(w.lightLevel);

  updateCamera(dt, t.state === 'chase');
  audio.updateListener(camera);
  audio.setTung(t.pos, t.canSee);

  // HUD
  $('timer').textContent = fmt(g.elapsed);
  updateMeter(t);
  const near = THREE.MathUtils.clamp((14 - t.dist) / 14, 0, 1);
  $('danger').style.opacity = near * 0.85;
}

function updateMeter(t) {
  const m = Math.round(t.dist);
  let text = `viene por ti · ${m}m`, cls = '';
  if (t.state === 'windup') [text, cls] = ['acaba de despertar. está FURIOSO', 'warm'];
  else if (t.dist < 8) [text, cls] = [`JUSTO DETRÁS DE TI · ${m}m`, 'hot'];
  else if (t.dist < 20) [text, cls] = [`TE TIENE EN LA MIRA · ${m}m`, 'warm'];
  const el = $('meterText');
  if (el.textContent !== text) el.textContent = text;
  el.className = cls;
}

function updateCamera(dt, chasing) {
  const g = game, p = g.player, w = g.world;
  const cp = Math.cos(pitch);
  const ox = Math.sin(yaw) * cp, oy = Math.sin(pitch), oz = Math.cos(yaw) * cp;
  _shoulder.set(Math.cos(yaw) * SHOULDER, 0, -Math.sin(yaw) * SHOULDER);
  const px = p.pos.x, py = PIVOT_Y, pz = p.pos.z;
  const ex = _shoulder.x + ox * CAM_DIST, ey = oy * CAM_DIST, ez = _shoulder.z + oz * CAM_DIST;

  // Pull the camera in when a wall or the ceiling is in the way.
  let free = 1;
  for (let s = 1; s <= 32; s++) {
    const f = s / 32;
    const x = px + ex * f, y = py + ey * f, z = pz + ez * f;
    if (w.blocked(x, z, 0.22) || y > WALL_H - 0.12 || y < 0.15) {
      free = (s - 1) / 32;
      break;
    }
  }
  g.camT = free < g.camT ? free : THREE.MathUtils.damp(g.camT, free, 4, dt);
  camera.position.set(px + ex * g.camT, py + ey * g.camT, pz + ez * g.camT);
  camera.lookAt(camera.position.x - ox, camera.position.y - oy, camera.position.z - oz);
  g.av.root.visible = g.camT * CAM_DIST > 0.7;

  const shake = chasing ? THREE.MathUtils.clamp((8 - g.tung.dist) / 8, 0, 1) * 0.04 : 0;
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
}

// ---------- jumpscare & game over ----------
function startJumpscare() {
  const g = game, t = g.tung, p = g.player;
  mode = 'caught';
  g.caughtT = 0;
  g.hitDone = false;
  audio.stopChaseMusic(0.15);
  audio.jumpscare();
  audio.speak('SAHUR!', { rate: 0.9 });
  if (document.pointerLockElement) document.exitPointerLock();
  hideBubble();
  $('hud').classList.add('hidden');
  $('jumpscare').classList.remove('hidden');
  $('danger').style.opacity = 0.8;
  t.heading = Math.atan2(p.pos.x - t.pos.x, p.pos.z - t.pos.z);
  t.model.root.rotation.y = t.heading;
  t.model.root.position.copy(t.pos);
  g.av.root.visible = false;
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

function updateJumpscare(dt) {
  const g = game, t = g.tung;
  g.caughtT += dt;
  t.poseJumpscare(g.caughtT);
  const fx = Math.sin(t.heading), fz = Math.cos(t.heading);
  const lunge = Math.min(1, g.caughtT / 0.3);
  const dist = 1.7 - 0.4 * lunge;
  const shake = g.caughtT < 1.2 ? 0.035 : 0.01;
  camera.position.set(
    t.pos.x + fx * dist + (Math.random() - 0.5) * shake,
    TUNG_FACE_Y + (Math.random() - 0.5) * shake,
    t.pos.z + fz * dist + (Math.random() - 0.5) * shake,
  );
  camera.lookAt(t.pos.x + fx * 0.4, TUNG_FACE_Y, t.pos.z + fz * 0.4);
  aimEyes(t.model, camera.position.x, camera.position.y, camera.position.z);
  g.world.updateLights(dt, t.pos.x, t.pos.z);

  if (!g.hitDone && g.caughtT > 0.47) {
    g.hitDone = true;
    audio.hit();
    const f = $('flash');
    f.style.transition = 'none';
    f.style.opacity = 0.9;
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.7s';
      f.style.opacity = 0;
    });
  }
  if (g.caughtT > 1.8) {
    if (selected.id === 'li') startCutscene();
    else gameOver();
  }
}

function startCutscene() {
  const g = game;
  mode = 'cutscene';
  g.cutscene = new LiCutscene({ scene: g.scene, world: g.world, camera, audio, av: g.av, tung: g.tung });
}

// Li's conversion always plays to the end, then gets its own game-over title and quote.
function endCutscene() {
  if (mode !== 'cutscene') return;
  game.cutscene.dispose();
  gameOver({ title: 'CONVERTIDO', quip: 'Siempre fue un tronco.' });
}

function gameOver(special = {}) {
  const g = game;
  mode = 'over';
  audio.silence();
  $('jumpscare').classList.add('hidden');
  const best = Math.max(getBest(), g.elapsed);
  const isNew = g.elapsed >= best && g.elapsed > 0;
  store.set('tripleT.best', String(best));
  const st = g.stats;
  $('goTitle').textContent = special.title || pick(DEATH_TITLES);
  $('goQuip').textContent = `"${special.quip || pick(selected.lines.death)}"`;
  $('survived').textContent = `${selected.name} sobrevivió ${fmt(g.elapsed)}`;
  $('rank').textContent = `Rango: ${rankFor(g.elapsed)}`;
  $('stats').innerHTML = [
    ['Escapes por poco', st.closeCalls], ['Metros corridos', Math.round(st.distance)],
  ].map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join('');
  $('bestLine').textContent = isNew ? '¡Nuevo récord personal!' : `Récord: ${fmt(best)}`;
  $('gameover').classList.remove('hidden');
}

// ---------- main loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (mode === 'playing' || mode === 'paused') camera.fov = baseFov();
  camera.updateProjectionMatrix();
  // Portrait phones: center the avatar above the bottom menu sheet.
  const portrait = w < h;
  menu.cam.aspect = w / h;
  menu.cam.fov = portrait ? 60 : 42;
  menu.cam.position.set(portrait ? 0 : -1.25, portrait ? 1.2 : 1.35, portrait ? 5.2 : 4.2);
  menu.cam.lookAt(portrait ? 0 : -1.25, portrait ? -0.4 : 1.0, 0);
  menu.cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(dt) {
  time += dt;
  if (mode === 'menu') {
    updateMenu(dt);
    renderer.render(menu.scene, menu.cam);
    return;
  }
  if (!game) return;
  if (mode === 'playing') {
    updateGame(dt);
    placeBubble();
  }
  else if (mode === 'caught') updateJumpscare(dt);
  else if (mode === 'cutscene' && game.cutscene.update(dt)) endCutscene();
  renderer.render(game.scene, camera);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frame(dt);
}

setMenuAvatar(selected);
renderCards();
requestAnimationFrame(loop);

// Debug handle for poking at the game from the console.
window.tripleT = { get game() { return game; }, menu, startGame, camera, audio, step: frame };
