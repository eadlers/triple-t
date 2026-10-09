import * as THREE from 'three';
import { buildTung, aimEyes, addLiLook } from './tung.js';
import { poseAvatar } from './avatars.js';

// Li's death cutscene: he realizes he was Tung Tung Tung Sahur all along, and converts.
const $ = (id) => document.getElementById(id);
const WOOD = new THREE.Color('#c27d43');

// [time, speaker, line, voice]
const SCRIPT = [
  [0.6, 'TUNG', 'Li... deja de correr.', 'tung'],
  [3.2, 'TUNG', 'Mira tu camisa, Li.', 'tung'],
  [5.8, 'LI', '¿Mis... rayas?', 'li'],
  [8.2, 'LI', 'Líneas verticales... igualitas... a la madera.', 'li'],
  [11.2, 'LI', 'Siempre despierto a las 3am... justo antes del sahur...', 'li'],
  [14.2, 'LI', 'No... yo siempre fui... ¡TRIPLE T!', 'li'],
  [19.4, 'TUNG', 'Bienvenido a casa, hermano.', 'tung'],
  [22.0, 'TUNG LI', 'Tung tung tung tung tung tung sahur.', 'chant'],
];
const SPIN_START = 15.8, CONVERT = 18.6, CHANT = 22, END_CARD = 25.5, DONE = 29;

// Nearest spot with a clear 3.6m radius so the camera has room.
function findStage(world, near) {
  let best = null, bestD = Infinity;
  for (let c = 0; c < world.W * world.H; c++) {
    const { x, z } = world.cellCenter(c);
    const d = (x - near.x) ** 2 + (z - near.z) ** 2;
    if (d >= bestD) continue;
    let ok = true;
    for (let a = 0; a < 12 && ok; a++) {
      const ang = (a / 12) * Math.PI * 2;
      ok = world.clearLine(x, z, x + Math.sin(ang) * 3.6, z + Math.cos(ang) * 3.6, 0.3);
    }
    if (ok) {
      best = { x, z };
      bestD = d;
    }
  }
  return best || { x: near.x, z: near.z };
}

export class LiCutscene {
  constructor({ scene, world, camera, audio, av, tung }) {
    Object.assign(this, { scene, world, camera, audio, av, tung });
    this.t = 0;
    this.line = -1;
    this.converted = false;
    this.ended = false;

    const stage = findStage(world, tung.pos);
    this.center = new THREE.Vector3(stage.x, 0, stage.z);
    this.liPos = new THREE.Vector3(stage.x - 1.1, 0, stage.z);
    this.tungPos = new THREE.Vector3(stage.x + 1.1, 0, stage.z);

    // Li stands up again, facing Tung (+x).
    av.root.visible = true;
    av.root.position.copy(this.liPos);
    av.root.rotation.set(0, Math.PI / 2, 0);
    this.liMats = [];
    av.root.traverse((o) => {
      if (o.material && o.material.color && !this.liMats.some((m) => m.mat === o.material)) {
        this.liMats.push({ mat: o.material, orig: o.material.color.clone() });
      }
    });

    const m = tung.model;
    m.root.position.copy(this.tungPos);
    m.root.rotation.set(0, -Math.PI / 2, 0);
    this.resetTung(m);
    tung.marks['!'].visible = false;

    this.tungLi = buildTung();
    addLiLook(this.tungLi);
    this.tungLi.root.position.copy(this.liPos);
    this.tungLi.root.rotation.y = Math.PI / 2;
    this.tungLi.root.visible = false;
    scene.add(this.tungLi.root);

    camera.fov = 45;
    camera.updateProjectionMatrix();
    $('jumpscare').classList.add('hidden');
    $('danger').style.opacity = 0;
    $('caption').classList.add('hidden');
    $('cutTitle').classList.remove('show');
    $('cutscene').classList.remove('hidden');
  }

  resetTung(m) {
    m.rig.position.set(0, 0, 0);
    m.rig.rotation.set(0, 0, 0);
    for (const leg of m.legs) leg.rotation.x = 0;
    for (const arm of m.arms) arm.shoulder.rotation.x = 0;
  }

  speakLine([, , text, voice]) {
    if (voice === 'chant') this.audio.speak(text, { pitch: 0.1, rate: 1.05 });
    else if (voice === 'tung') this.audio.speak(text, { pitch: 0.1, rate: 1.0, lang: 'es' });
    else this.audio.speak(text, { pitch: 1.05, rate: 1.0, lang: 'es' });
  }

  shot(px, py, pz, lx, ly, lz, roll = 0, shake = 0) {
    const c = this.camera;
    c.position.set(px + (Math.random() - 0.5) * shake, py + (Math.random() - 0.5) * shake, pz);
    c.lookAt(lx, ly, lz);
    if (roll) c.rotateZ(roll);
  }

  flash() {
    const f = $('flash');
    f.style.transition = 'none';
    f.style.opacity = 1;
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 1.2s';
      f.style.opacity = 0;
    });
  }

  // Returns true when finished.
  update(dt) {
    this.t += dt;
    const t = this.t, c = this.center, li = this.liPos, av = this.av;
    this.world.updateLights(dt, c.x, c.z);

    // Captions and voices
    while (this.line + 1 < SCRIPT.length && t >= SCRIPT[this.line + 1][0]) {
      this.line++;
      const entry = SCRIPT[this.line];
      $('speaker').textContent = entry[1];
      $('line').textContent = entry[2];
      $('caption').classList.remove('hidden');
      this.speakLine(entry);
    }

    // Li's acting
    if (!this.converted) {
      poseAvatar(av, 0, 0, 0, t);
      const [l, r] = av.arms;
      if (t >= 5.8 && t < 8.2) {
        av.head.rotation.x = 0.45;
        r.shoulder.rotation.x = -0.7;
        r.elbow.rotation.x = -1.5;
      } else if (t >= 8.2 && t < 11.2) {
        av.head.rotation.x = 0.15;
        av.head.rotation.z = 0.15;
        r.shoulder.rotation.x = -1.0;
        r.elbow.rotation.x = -2.2;
      } else if (t >= 11.2 && t < SPIN_START) {
        // Hands on head: mind blown.
        l.shoulder.rotation.set(-2.5, 0, -0.6);
        r.shoulder.rotation.set(-2.5, 0, 0.6);
        l.elbow.rotation.x = r.elbow.rotation.x = -2.1;
        av.head.rotation.y = Math.sin(t * (t > 14.2 ? 30 : 6)) * (t > 14.2 ? 0.15 : 0.25);
      } else if (t >= SPIN_START) {
        // Spinning, rising, turning to wood.
        const k = Math.min(1, (t - SPIN_START) / (CONVERT - SPIN_START));
        l.shoulder.rotation.set(0, 0, -1.45);
        r.shoulder.rotation.set(0, 0, 1.45);
        l.elbow.rotation.x = r.elbow.rotation.x = 0;
        this.spin = (this.spin || 0) + dt * (2 + k * k * 40);
        av.root.rotation.y = Math.PI / 2 + this.spin;
        av.root.position.y = Math.sin(k * Math.PI) * 0.5;
        for (const { mat, orig } of this.liMats) mat.color.copy(orig).lerp(WOOD, k);
        this.knockTimer = (this.knockTimer || 0) - dt;
        if (this.knockTimer <= 0) {
          this.audio.knocks(3, 0.12 - k * 0.07);
          this.knockTimer = 0.9 - k * 0.6;
        }
      }
    }

    if (!this.converted && t >= CONVERT) {
      this.converted = true;
      av.root.visible = false;
      this.tungLi.root.visible = true;
      this.flash();
      this.audio.knocks(3, 0.18);
    }

    // Tung's acting
    const m = this.tung.model, tl = this.tungLi;
    if (t < CHANT) {
      aimEyes(m, li.x, 1.7, li.z);
      aimEyes(tl, m.root.position.x, 2.3, m.root.position.z);
    } else {
      // Both turn to the camera and chant with bats raised.
      if (!this.chanting) {
        this.chanting = true;
        this.audio.startChaseMusic();
      }
      for (const [model, ph] of [[m, 0], [tl, Math.PI]]) {
        model.root.rotation.y = THREE.MathUtils.damp(model.root.rotation.y, 0, 4, dt);
        model.rig.position.y = Math.abs(Math.sin(t * 7 + ph)) * 0.18;
        model.arms[0].shoulder.rotation.x = -2.7 + Math.sin(t * 14 + ph) * 0.25;
        model.arms[1].shoulder.rotation.x = -2.7 - Math.sin(t * 14 + ph) * 0.25;
        model.legs[0].rotation.x = Math.sin(t * 14 + ph) * 0.3;
        model.legs[1].rotation.x = -Math.sin(t * 14 + ph) * 0.3;
        aimEyes(model, this.camera.position.x, this.camera.position.y, this.camera.position.z);
      }
    }

    // Camera shots
    const k = (a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
    if (t < 3.2) {
      this.shot(c.x - 0.4, 1.6, c.z + 4.2 - k(0, 3.2) * 0.4, c.x, 1.5, c.z);
    } else if (t < 5.8) {
      const p = k(3.2, 5.8);
      this.shot(li.x + 0.6, 1.55, li.z + 2.6 - p * 0.8, li.x, 1.45, li.z);
    } else if (t < 8.2) {
      this.shot(li.x + 1.25, 1.5, li.z + 0.3, li.x, 1.3, li.z);
    } else if (t < 11.2) {
      const p = k(8.2, 11.2);
      this.shot(li.x + 0.95 - p * 0.2, 1.72, li.z + 0.3, li.x, 1.68, li.z, 0.12);
    } else if (t < SPIN_START) {
      const extreme = t >= 14.2;
      this.shot(li.x + (extreme ? 0.55 : 0.85), 1.7, li.z + 0.2, li.x, 1.68, li.z, extreme ? 0.3 : 0.2, extreme ? 0.02 : 0);
    } else if (t < CONVERT) {
      const a = (t - SPIN_START) * 1.2;
      this.shot(li.x + Math.sin(a) * 2.6, 1.4, li.z + Math.cos(a) * 2.6, li.x, 1.5, li.z, 0, 0.03);
    } else if (t < CHANT) {
      this.shot(c.x, 1.9, c.z + 3.6, c.x, 1.7, c.z);
    } else {
      const p = k(CHANT, END_CARD);
      this.shot(c.x, 1.7 + p * 0.3, c.z + 4.6 - p * 0.6, c.x, 1.6, c.z);
    }

    if (t >= END_CARD && !this.ended) {
      this.ended = true;
      $('caption').classList.add('hidden');
      $('cutTitle').classList.add('show');
    }
    return t >= DONE;
  }

  dispose() {
    $('cutscene').classList.add('hidden');
    $('cutTitle').classList.remove('show');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
