import * as THREE from 'three';
import { woodTexture, stripeTexture } from './textures.js';

// Tung Tung Tung Sahur: a tall carved wooden log with an uncanny human face,
// thin stick arms and legs, and a wooden baseball bat.
const BODY_H = 1.8, R_BOT = 0.36, R_TOP = 0.4, BODY_Y = 0.97;
const rAt = (y) => R_BOT + (R_TOP - R_BOT) * THREE.MathUtils.clamp(y / BODY_H, 0, 1);
const surf = (x, y) => Math.sqrt(Math.max(0, rAt(y) ** 2 - x * x));
export const TUNG_FACE_Y = BODY_Y + 1.3;

function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function tubeOnFace(points, dz, radius, mat, parent) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, surf(x, y) + dz)));
  const tube = add(parent, new THREE.TubeGeometry(curve, 32, radius, 8), mat);
  for (const t of [0, 1]) {
    const p = curve.getPoint(t);
    add(parent, new THREE.SphereGeometry(radius, 8, 6), mat, p.x, p.y, p.z);
  }
  return tube;
}

export function buildTung() {
  const tex = woodTexture();
  tex.repeat.set(1.4, 1);
  const wood = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  const face = new THREE.MeshStandardMaterial({ color: '#c47f45', roughness: 0.5 });
  const crease = new THREE.MeshStandardMaterial({ color: '#a8642f', roughness: 0.6 });
  const brow = new THREE.MeshStandardMaterial({ color: '#b26c36', roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: '#341607', roughness: 0.7 });
  const lip = new THREE.MeshStandardMaterial({ color: '#c07642', roughness: 0.45 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.15, emissive: '#2a2620' });
  const iris = new THREE.MeshStandardMaterial({ color: '#5b3a20', roughness: 0.2 });
  const pupil = new THREE.MeshStandardMaterial({ color: '#070504', roughness: 0.1 });
  const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const batWood = new THREE.MeshStandardMaterial({ map: tex, color: '#f0c48c', roughness: 0.45 });

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // Body log (lathe with rounded top/bottom edges; seam at the back).
  const pts = [new THREE.Vector2(0.001, 0)];
  const rb = 0.07, rt = 0.12;
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R_BOT - rb + rb * Math.cos(a), rb + rb * Math.sin(a)));
  }
  for (let i = 1; i <= 10; i++) {
    const y = rb + (BODY_H - rb - rt) * (i / 10);
    pts.push(new THREE.Vector2(rAt(y), y));
  }
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R_TOP - rt + rt * Math.cos(a), BODY_H - rt + rt * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0.001, BODY_H));
  const bodyG = new THREE.Group();
  bodyG.position.y = BODY_Y;
  rig.add(bodyG);
  add(bodyG, new THREE.LatheGeometry(pts, 56, Math.PI), wood);

  // ---- Face ----
  const faceG = new THREE.Group();
  bodyG.add(faceG);
  const EY = 1.42, EX = 0.14, ER = 0.085;
  const irisPivots = [];
  for (const s of [-1, 1]) {
    const ex = s * EX, ez = surf(ex, EY) - 0.012;
    const eye = add(faceG, new THREE.SphereGeometry(ER, 28, 18), eyeWhite, ex, EY, ez);
    eye.scale.set(1, 0.92, 0.75);
    const pivot = new THREE.Group();
    pivot.position.set(ex, EY, ez);
    faceG.add(pivot);
    add(pivot, new THREE.SphereGeometry(0.046, 20, 14), iris, 0, 0, 0.026);
    add(pivot, new THREE.SphereGeometry(0.024, 14, 10), pupil, 0, 0, 0.052);
    add(pivot, new THREE.SphereGeometry(0.01, 8, 6), glint, -0.016, 0.018, 0.07);
    irisPivots.push(pivot);

    const lid = add(faceG, new THREE.SphereGeometry(ER + 0.006, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.27), face, ex, EY + 0.004, ez);
    lid.scale.set(1.05, 0.95, 0.82);
    lid.rotation.x = 0.05;
    const bag = add(faceG, new THREE.TorusGeometry(ER - 0.003, 0.014, 8, 20, Math.PI), face, ex, EY - 0.006, ez + 0.02);
    bag.rotation.z = Math.PI;
    bag.scale.z = 0.6;

    // Raised, arched brows: the "surprised" stare.
    const bx = (t) => ex + t * 0.1;
    tubeOnFace(
      [-1, -0.5, 0, 0.5, 1].map((t) => [bx(t), EY + 0.128 + (1 - t * t) * 0.04 - s * t * 0.008]),
      0.004, 0.024, brow, faceG,
    );
  }

  // Long nose
  const bridge = add(faceG, new THREE.CylinderGeometry(0.03, 0.05, 0.22, 16), face, 0, 1.33, surf(0, 1.33) + 0.026);
  bridge.rotation.x = -0.22;
  add(faceG, new THREE.SphereGeometry(0.031, 12, 8), face, 0, 1.43, surf(0, 1.43) + 0.004);
  const tip = add(faceG, new THREE.SphereGeometry(0.058, 20, 14), face, 0, 1.235, surf(0, 1.235) + 0.05);
  tip.scale.set(1, 0.85, 0.95);
  for (const s of [-1, 1]) {
    add(faceG, new THREE.SphereGeometry(0.036, 14, 10), face, s * 0.05, 1.225, surf(s * 0.05, 1.225) + 0.022);
    const n = add(faceG, new THREE.SphereGeometry(0.016, 8, 6), dark, s * 0.025, 1.195, surf(0, 1.195) + 0.046);
    n.scale.y = 0.5;
  }

  // Cheeks and chin
  for (const s of [-1, 1]) {
    const c = add(faceG, new THREE.SphereGeometry(0.09, 20, 14), face, s * 0.165, 1.2, surf(s * 0.165, 1.2) - 0.006);
    c.scale.set(1, 0.75, 0.45);
    tubeOnFace([[s * 0.075, 1.25], [s * 0.13, 1.19], [s * 0.19, 1.13]], 0.006, 0.013, face, faceG);
  }
  const chin = add(faceG, new THREE.SphereGeometry(0.08, 18, 12), face, 0, 1.0, surf(0, 1.0) - 0.006);
  chin.scale.set(1.3, 0.6, 0.12);

  // Closed-lip smirk
  tubeOnFace([[-0.175, 1.135], [-0.1, 1.1], [0, 1.092], [0.1, 1.102], [0.18, 1.145]], 0.008, 0.007, dark, faceG);
  tubeOnFace([[-0.145, 1.13], [-0.08, 1.112], [0, 1.106], [0.08, 1.115], [0.15, 1.14]], 0.0, 0.012, lip, faceG);
  tubeOnFace([[-0.13, 1.115], [-0.06, 1.084], [0, 1.078], [0.07, 1.086], [0.14, 1.122]], 0.0, 0.016, lip, faceG);

  // Forehead wrinkles from the raised brows
  for (const y of [1.64, 1.69]) tubeOnFace([[-0.15, y - 0.01], [0, y + 0.012], [0.15, y - 0.01]], -0.002, 0.007, crease, faceG);

  // ---- Limbs ----
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.14, BODY_Y + 0.02, 0);
    rig.add(hip);
    add(hip, new THREE.CylinderGeometry(0.05, 0.043, BODY_Y, 10), wood, 0, -BODY_Y / 2, 0);
    const foot = add(hip, new THREE.SphereGeometry(0.055, 12, 8), wood, 0, -BODY_Y + 0.02, 0.03);
    foot.scale.set(1, 0.6, 1.6);
    return hip;
  });

  const ARM_L = 0.78;
  const arms = [-1, 1].map((s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * (R_BOT + 0.04), BODY_Y + 0.72, 0);
    shoulder.rotation.z = s * 0.12;
    rig.add(shoulder);
    add(shoulder, new THREE.CylinderGeometry(0.038, 0.033, ARM_L, 10), wood, 0, -ARM_L / 2, 0);
    add(shoulder, new THREE.SphereGeometry(0.045, 10, 8), wood, 0, 0, 0);
    const hand = new THREE.Group();
    hand.position.y = -ARM_L;
    shoulder.add(hand);
    add(hand, new THREE.SphereGeometry(0.042, 10, 8), wood);
    for (let f = 0; f < 3; f++) {
      const finger = add(hand, new THREE.CylinderGeometry(0.01, 0.009, 0.06, 6), wood, (f - 1) * 0.018, -0.045, 0.012);
      finger.rotation.x = 0.3;
    }
    return { shoulder, hand };
  });

  // Bat in Tung's right hand (-x since he faces +z).
  const batPts = [
    [0.0, 0], [0.032, 0.005], [0.034, 0.02], [0.018, 0.04], [0.017, 0.3], [0.024, 0.45],
    [0.042, 0.65], [0.05, 0.8], [0.048, 0.86], [0.03, 0.885], [0.0, 0.89],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bat = new THREE.Group();
  add(bat, new THREE.LatheGeometry(batPts, 16), batWood, 0, -0.06, 0);
  bat.rotation.x = Math.PI * 0.72;
  arms[0].hand.add(bat);

  return { root, rig, bodyG, legs, arms, bat, irisPivots };
}

// Dresses a Tung model as Li after his conversion: swept hair, beard, mustache, striped shirt.
export function addLiLook(model) {
  const hair = new THREE.MeshStandardMaterial({ color: '#8a6a4b', roughness: 1 });
  const light = new THREE.MeshStandardMaterial({ color: '#b08a64', roughness: 1 });
  const beard = new THREE.MeshStandardMaterial({ color: '#5a3f2c', roughness: 1, side: THREE.DoubleSide });
  const shirtTex = stripeTexture();
  shirtTex.repeat.set(7, 2);
  const shirt = new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.85, side: THREE.DoubleSide });
  const b = model.bodyG;

  const mound = add(b, new THREE.SphereGeometry(0.41, 32, 16), hair, 0, BODY_H - 0.01, -0.02);
  mound.scale.set(1.02, 0.3, 1.02);
  const quiff = add(b, new THREE.SphereGeometry(1, 20, 12), hair, 0, BODY_H + 0.07, 0.2);
  quiff.scale.set(0.27, 0.11, 0.2);
  quiff.rotation.x = -0.45;
  for (let i = -2; i <= 2; i++) {
    const st = add(b, new THREE.SphereGeometry(1, 10, 6), light, i * 0.09, BODY_H + 0.1, 0.0);
    st.scale.set(0.022, 0.02, 0.26);
  }

  add(b, new THREE.CylinderGeometry(rAt(1.05) + 0.014, rAt(0.86) + 0.014, 0.19, 40, 1, true, -1.35, 2.7), beard, 0, 0.955, 0);
  for (const s of [-1, 1]) {
    const start = s > 0 ? 0.62 : -1.35;
    add(b, new THREE.CylinderGeometry(rAt(1.24) + 0.012, rAt(1.0) + 0.012, 0.24, 16, 1, true, start, 0.73), beard, 0, 1.12, 0);
  }
  tubeOnFace([[-0.13, 1.148], [-0.05, 1.168], [0, 1.162], [0.05, 1.168], [0.13, 1.148]], 0.014, 0.022, beard, model.bodyG);

  add(b, new THREE.CylinderGeometry(rAt(0.85) + 0.012, rAt(0.12) + 0.012, 0.73, 48, 1, true), shirt, 0, 0.485, 0);
  for (const s of [-1, 1]) {
    const collar = add(b, new THREE.BoxGeometry(0.16, 0.06, 0.02), shirt, s * 0.09, 0.85, rAt(0.85) + 0.01);
    collar.rotation.set(-0.3, 0, s * 0.5);
  }
  for (const arm of model.arms) add(arm.shoulder, new THREE.CylinderGeometry(0.075, 0.07, 0.17, 12, 1, true), shirt, 0, -0.07, 0);
}

const _local = new THREE.Vector3();

// Swivel the irises toward a world point (clamped so they stay on the eyeballs).
export function aimEyes(model, x, y, z) {
  model.root.updateMatrixWorld(true);
  for (const p of model.irisPivots) {
    _local.set(x, y, z);
    p.parent.worldToLocal(_local);
    _local.sub(p.position);
    const yaw = THREE.MathUtils.clamp(Math.atan2(_local.x, _local.z), -0.45, 0.45);
    const pitch = THREE.MathUtils.clamp(Math.atan2(_local.y, Math.hypot(_local.x, _local.z)), -0.35, 0.3);
    p.rotation.set(-pitch, yaw, 0);
  }
}

const CHASE_SPEED = 4.5;
const WINDUP = 2.5;

// Metal Gear style "!" / "?" that floats over Tung's head.
function markSprite(ch, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 112px Impact, Anton, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#000';
  g.strokeText(ch, 64, 68);
  g.fillStyle = color;
  g.fillText(ch, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.renderOrder = 999;
  sp.position.y = 2.95;
  sp.visible = false;
  return sp;
}

export class Tung {
  constructor(world, scene) {
    this.world = world;
    this.model = buildTung();
    scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.heading = 0;
    this.state = 'windup';
    this.path = [];
    this.repath = 0;
    this.windup = 0;
    this.phase = 0;
    this.speedNow = 0;
    this.stuck = 0;
    this.forcePath = 0;
    this.canSee = false;
    this.armRaise = 0;
    this.stateTime = 0;
    this.marks = { '!': markSprite('!', '#ff2a2a') };
    this.model.root.add(this.marks['!']);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  spawnAwayFrom(p) {
    const w = this.world;
    const d = w.distances(w.cellOf(p.x, p.z));
    let cands = [];
    for (let i = 0; i < d.length; i++) if (d[i] >= 12 && d[i] <= 20) cands.push(i);
    if (!cands.length) {
      let best = 0;
      for (let i = 0; i < d.length; i++) if (d[i] > d[best]) best = i;
      cands = [best];
    }
    const c = w.cellCenter(cands[(Math.random() * cands.length) | 0]);
    this.pos.set(c.x, 0, c.z);
    this.heading = Math.atan2(p.x - c.x, p.z - c.z);
    this.setState('windup');
    this.windup = WINDUP;
    this.path = [];
  }

  setGoal(x, z) {
    const w = this.world;
    this.goal.set(x, 0, z);
    this.path = w.bfs(w.cellOf(this.pos.x, this.pos.z), w.cellOf(x, z)) || [];
  }

  turnTo(target, dt, rate) {
    let d = target - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
  }

  moveToward(tx, tz, speed, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      const step = Math.min(d, speed * dt);
      const bx = this.pos.x, bz = this.pos.z;
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.world.collide(this.pos, 0.42);
      this.speedNow = Math.hypot(this.pos.x - bx, this.pos.z - bz) / Math.max(dt, 1e-4);
      this.turnTo(Math.atan2(dx, dz), dt, this.state === 'chase' ? 9 : 4);
    }
    return d;
  }

  followPath(speed, dt) {
    const w = this.world;
    // Skip ahead when the next-next cell is in straight, clear view.
    while (this.path.length > 1) {
      const c = w.cellCenter(this.path[1]);
      if (!w.clearLine(this.pos.x, this.pos.z, c.x, c.z, 0.45)) break;
      this.path.shift();
    }
    if (!this.path.length) return true;
    let { x, z } = w.cellCenter(this.path[0]);
    if (this.path.length === 1) {
      x = this.goal.x;
      z = this.goal.z;
    }
    if (this.moveToward(x, z, speed, dt) < 0.5) this.path.shift();
    return this.path.length === 0;
  }

  // Tung always knows where you are: a short windup at spawn, then a relentless chase.
  // Returns { caught } for this frame.
  update(dt, player) {
    const w = this.world;
    const ev = {};
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const sees = dist < 28 && w.los(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
    this.canSee = sees;
    this.speedNow = 0;
    this.dist = dist;

    if (dist < 1.05) ev.caught = true;

    if (this.state === 'windup') {
      this.turnTo(Math.atan2(dx, dz), dt, 8);
      this.windup -= dt;
      if (this.windup <= 0) {
        this.setState('chase');
        this.repath = 0;
      }
    } else {
      this.forcePath -= dt;
      const direct = sees && this.forcePath <= 0 && w.clearLine(this.pos.x, this.pos.z, player.pos.x, player.pos.z, 0.42);
      if (direct) {
        this.moveToward(player.pos.x, player.pos.z, CHASE_SPEED, dt);
        this.path = [];
      } else {
        this.repath -= dt;
        if (this.repath <= 0 || !this.path.length) {
          this.setGoal(player.pos.x, player.pos.z);
          this.repath = 0.4;
        }
        this.followPath(CHASE_SPEED, dt);
      }
      // Unstick from corners by falling back to grid pathing.
      if (this.speedNow < 0.8) {
        this.stuck += dt;
        if (this.stuck > 0.5) {
          this.forcePath = 1.2;
          this.repath = 0;
          this.stuck = 0;
        }
      } else this.stuck = 0;
    }

    this.stateTime += dt;
    this.animate(dt, player);
    return ev;
  }

  animate(dt, player) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.heading;
    const chasing = this.state === 'chase' || this.state === 'windup';
    this.phase += this.speedNow * dt * 2.1;
    const amp = Math.min(1, this.speedNow / 2) * (chasing ? 0.6 : 0.38);
    const s = Math.sin(this.phase);
    m.legs[0].rotation.x = s * amp;
    m.legs[1].rotation.x = -s * amp;
    m.rig.position.y = Math.abs(Math.cos(this.phase)) * 0.06 * Math.min(1, this.speedNow / 2);
    m.rig.rotation.z = s * 0.04 * Math.min(1, this.speedNow / 2);
    m.rig.rotation.x = chasing ? 0.08 : 0;

    this.armRaise = THREE.MathUtils.damp(this.armRaise, chasing ? 1 : 0, 6, dt);
    m.arms[1].shoulder.rotation.x = -s * amp * 0.8;
    m.arms[0].shoulder.rotation.x = THREE.MathUtils.lerp(s * amp * 0.5, -2.5 + Math.sin(performance.now() / 160) * 0.35, this.armRaise);

    this.lookAt(player.pos.x, 1.6, player.pos.z);
    this.updateMarks();
  }

  updateMarks() {
    const bang = this.marks['!'];
    bang.visible = this.state === 'windup';
    bang.scale.setScalar(1.1 + Math.max(0, 0.5 - this.stateTime) * 1.6);
  }

  lookAt(x, y, z) {
    aimEyes(this.model, x, y, z);
  }

  // Head-on bat swing for the jumpscare, t in seconds since caught.
  poseJumpscare(t) {
    const m = this.model;
    m.legs[0].rotation.x = m.legs[1].rotation.x = 0;
    m.rig.rotation.x = 0.12;
    const swing = t < 0.35 ? THREE.MathUtils.lerp(-2.4, -3.0, t / 0.35) : THREE.MathUtils.lerp(-3.0, -0.5, Math.min(1, (t - 0.35) / 0.15));
    m.arms[0].shoulder.rotation.x = swing;
    m.arms[1].shoulder.rotation.x = -0.6;
    m.rig.position.y = 0;
    this.marks['!'].visible = false;
  }
}
