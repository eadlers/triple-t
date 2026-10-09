import * as THREE from 'three';
import { mulberry32, stripeTexture, chessPrintTexture, fadeMaskTexture } from './textures.js';

// Stylized versions of the people in Images/<name>/.
export const AVATARS = [
  {
    id: 'chomp',
    name: 'Chomp',
    tagline: 'Polerón negro de ajedrez. Calcula cada ruta de escape.',
    skin: '#c08a63', hair: '#16110e', hairStyle: 'short', brows: '#14100c',
    top: 'hoodie', topColor: '#18181b', pants: '#2b3953', legs: 'long', shoes: '#ebe8e2',
    facial: 'light', smile: 'grin',
    lines: {
      chase: ['Necesito amigos'],
      escape: ['Casi me hacen jaque pastor'],
      idle: ['Algunas mujeres por aqui?'],
      death: ['Me enrocaron'],
    },
  },
  {
    id: 'pechar',
    name: 'Pechar',
    tagline: 'Realeza de pelo rizado. La corona nunca se la quita.',
    skin: '#e3b08b', hair: '#4a2e1d', hairStyle: 'curly', brows: '#3a2416',
    top: 'tee', topColor: '#cf6a40', pants: '#8c8e97', legs: 'shorts', shoes: '#26262a',
    facial: 'stubble', smile: 'big', crown: true, bracelets: true, fat: true,
    lines: {
      chase: ['Acabo de recrear'],
      escape: ['AAAAAAAAA'],
      idle: ['Soy el mas feo de Lima'],
      death: ['No debi comer tantas hamburguesas'],
    },
  },
  {
    id: 'li',
    name: 'Li',
    tagline: 'Pelo para atrás, camisa a rayas, barba de acero.',
    skin: '#bd7944', hair: '#8a6a4b', hairStyle: 'swept', brows: '#5b4130',
    top: 'striped', topColor: '#dcd2b6', pants: '#2a2a2f', legs: 'long', shoes: '#3b3027',
    facial: 'beard', beard: '#5a3f2c', smile: 'smirk', bracelets: true,
    lines: {
      chase: ['Se parece a mi'],
      escape: ['Tengo que desarollar el bishop'],
      idle: ['RA, el dios de la versatilidad'],
      death: ['Me detonaron'],
    },
  },
];

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

// Builds a ~1.85m character facing +z with feet at y = 0.
export function buildAvatar(cfg) {
  const skin = std(cfg.skin, { roughness: 0.6 });
  const top = cfg.top === 'striped'
    ? new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.85 })
    : std(cfg.topColor, { roughness: 0.92 });
  const topTrim = std(new THREE.Color(cfg.topColor).multiplyScalar(0.75), { roughness: 0.92 });
  const pants = std(cfg.pants, { roughness: 0.95 });
  const shoes = std(cfg.shoes, { roughness: 0.7 });
  const sole = std('#f2f0ea', { roughness: 0.8 });
  const hair = std(cfg.hair, { roughness: 1 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Build: f scales limb thickness; chest size and stance widen with it.
  const f = cfg.fat ? 1.4 : 1;
  const chestW = cfg.fat ? 0.56 : 0.42, chestD = cfg.fat ? 0.36 : 0.24;

  // Legs
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * (cfg.fat ? 0.14 : 0.1), 0.9, 0);
    body.add(hip);
    if (cfg.legs === 'shorts') {
      add(hip, cyl(0.1 * f, 0.096 * f, 0.3, 14), pants, 0, -0.13, 0);
      add(hip, cyl(0.075 * f, 0.065 * f, 0.44), skin, 0, -0.22, 0);
    } else {
      add(hip, cyl(0.088 * f, 0.074 * f, 0.46), pants, 0, -0.22, 0);
    }
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    add(knee, cyl(0.07 * f, 0.054 * f, 0.42), cfg.legs === 'shorts' ? skin : pants, 0, -0.2, 0);
    if (cfg.legs === 'shorts') add(knee, cyl(0.056 * f, 0.056 * f, 0.06), sole, 0, -0.37, 0);
    add(knee, new THREE.BoxGeometry(0.11, 0.08, 0.26), shoes, 0, -0.415, 0.045);
    add(knee, new THREE.BoxGeometry(0.116, 0.025, 0.27), sole, 0, -0.455, 0.045);
    return { hip, knee };
  });

  add(body, new THREE.BoxGeometry(cfg.fat ? 0.52 : 0.37, 0.18, cfg.fat ? 0.34 : 0.23), pants, 0, 0.93, 0);

  // Torso (chest spans y -0.01..0.55 in torso space)
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  body.add(torso);
  // Chest tapers toward the waist (or bulges toward it, for a belly).
  const chestGeo = new THREE.BoxGeometry(chestW, 0.56, chestD, 1, 4, 1);
  const pos = chestGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + 0.28) / 0.56;
    const k = cfg.fat ? 0.92 + 0.08 * Math.sin(t * Math.PI * 0.9) : 0.86 + 0.14 * t;
    pos.setX(i, pos.getX(i) * k);
  }
  chestGeo.computeVertexNormals();
  add(torso, chestGeo, top, 0, 0.27, 0);
  if (cfg.fat) {
    // Big round belly pushing the shirt out, with a little peek of belly at the bottom.
    const belly = add(torso, sph(0.3, 28, 20), top, 0, 0.17, 0.06);
    belly.scale.set(0.98, 0.88, 0.82);
    const peek = add(torso, sph(0.2, 24, 12), skin, 0, -0.035, 0.12);
    peek.scale.set(1.05, 0.22, 0.75);
    for (const s of [-1, 1]) {
      const side = add(torso, sph(0.16, 20, 14), top, s * 0.2, 0.18, 0);
      side.scale.set(0.7, 1.2, 1);
    }
  }
  for (const s of [-1, 1]) {
    const sh = add(torso, sph(0.09 * f), top, s * (chestW / 2 - 0.01), 0.48, 0);
    sh.scale.set(1, 0.85, 1.2);
  }
  add(torso, cyl(0.055 * f, 0.062 * f, 0.14), skin, 0, 0.6, 0);

  if (cfg.top === 'hoodie') {
    const hood = add(torso, new THREE.TorusGeometry(0.105, 0.03, 10, 24), top, 0, 0.565, -0.015);
    hood.rotation.x = Math.PI / 2;
    const back = add(torso, sph(0.1, 16, 10), top, 0, 0.5, -0.11);
    back.scale.set(1.1, 0.6, 0.3);
    for (const s of [-1, 1]) add(torso, cyl(0.006, 0.006, 0.15, 6), sole, s * 0.045, 0.46, 0.125);
    add(torso, new THREE.BoxGeometry(0.27, 0.13, 0.012), topTrim, 0, 0.1, 0.122);
    add(torso, new THREE.BoxGeometry(0.43, 0.05, 0.25), topTrim, 0, 0.0, 0);
    const print = add(
      torso,
      new THREE.PlaneGeometry(0.24, 0.12),
      new THREE.MeshStandardMaterial({ map: chessPrintTexture(), transparent: true, roughness: 0.9 }),
      0, 0.3, 0.1215,
    );
    print.renderOrder = 1;
  } else if (cfg.top === 'tee') {
    const collar = add(torso, new THREE.TorusGeometry(0.066, 0.009, 8, 20), topTrim, 0, 0.555, 0.0);
    collar.rotation.x = Math.PI / 2;
  } else if (cfg.top === 'striped') {
    for (const s of [-1, 1]) {
      const c = add(torso, new THREE.BoxGeometry(0.1, 0.045, 0.012), top, s * 0.055, 0.555, 0.11);
      c.rotation.set(-0.5, 0, s * 0.55);
    }
    const v = add(torso, new THREE.CircleGeometry(0.055, 3), skin, 0, 0.515, 0.1212);
    v.rotation.z = -Math.PI / 2;
    v.scale.set(1, 0.7, 1);
    add(torso, new THREE.BoxGeometry(0.014, 0.44, 0.004), topTrim, 0, 0.24, 0.1215);
  }

  // Arms
  const arms = [-1, 1].map((s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * (chestW / 2 + 0.06 * f), 0.5, 0);
    shoulder.rotation.z = s * (cfg.fat ? 0.2 : 0.06);
    torso.add(shoulder);
    const longSleeve = cfg.top === 'hoodie';
    if (longSleeve) {
      add(shoulder, cyl(0.065, 0.058, 0.32), top, 0, -0.15, 0);
    } else {
      add(shoulder, cyl(0.073 * f, 0.07 * f, 0.17), top, 0, -0.07, 0);
      add(shoulder, cyl(0.055 * f, 0.05 * f, 0.3), skin, 0, -0.15, 0);
    }
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    add(elbow, cyl(0.053 * f, 0.045 * f, 0.27), longSleeve ? top : skin, 0, -0.13, 0);
    if (longSleeve) add(elbow, cyl(0.049, 0.049, 0.04), topTrim, 0, -0.255, 0);
    const hand = add(elbow, sph(0.048 * Math.sqrt(f)), skin, 0, -0.31, 0);
    hand.scale.set(0.8, 1.15, 0.95);
    if (cfg.bracelets && s === 1) {
      const colors = cfg.id === 'pechar' ? ['#1b1b1b', '#6b4b2e', '#c9b48a', '#2e2e2e'] : ['#b9b9b9'];
      colors.forEach((col, i) => {
        const b = add(elbow, new THREE.TorusGeometry(0.05 * f, 0.007, 6, 16), std(col), 0, -0.235 + i * 0.016, 0);
        b.rotation.x = Math.PI / 2;
      });
    }
    return { shoulder, elbow };
  });

  // Head
  const head = new THREE.Group();
  head.position.y = 0.745;
  torso.add(head);
  buildHead(head, cfg, { skin, hair });

  return { root, body, torso, head, legs, arms, cfg };
}

function buildHead(head, cfg, { skin, hair }) {
  const R = 0.14;
  const wide = cfg.fat ? 1.06 : 0.92;
  const sx = R * wide, sy = R * 1.08, sz = R * 0.98;
  const surfZ = (x, y) => sz * Math.sqrt(Math.max(0, 1 - (x / sx) ** 2 - (y / sy) ** 2));

  const skull = add(head, new THREE.SphereGeometry(R, 32, 24), skin);
  skull.scale.set(wide, 1.08, 0.98);
  if (cfg.fat) {
    for (const s of [-1, 1]) {
      const cheek = add(head, sph(0.06, 16, 12), skin, s * 0.075, -0.045, surfZ(s * 0.075, -0.045) - 0.03);
      cheek.scale.set(1, 0.85, 0.7);
    }
    const chin = add(head, sph(0.11, 20, 14), skin, 0, -0.125, 0.025);
    chin.scale.set(1.05, 0.5, 0.95);
  }

  for (const s of [-1, 1]) {
    const ear = add(head, sph(0.035, 12, 8), skin, s * sx * 0.98, -0.005, -0.005);
    ear.scale.set(0.45, 1, 0.75);
  }

  const white = std('#f4f1ea', { roughness: 0.3 });
  const iris = std('#2e1c10', { roughness: 0.25 });
  const brow = std(cfg.brows, { roughness: 1 });
  for (const s of [-1, 1]) {
    const ex = s * 0.05, ey = 0.015, ez = surfZ(ex, ey) - 0.012;
    const eye = add(head, sph(0.021, 12, 10), white, ex, ey, ez);
    eye.scale.z = 0.6;
    add(head, sph(0.012, 10, 8), iris, ex, ey, ez + 0.009);
    const b = add(head, new THREE.BoxGeometry(0.052, 0.012, 0.016), brow, s * 0.052, 0.052, surfZ(s * 0.052, 0.052) + 0.002);
    b.rotation.z = s * -0.12;
  }

  const nose = add(head, sph(0.02, 12, 10), skin, 0, -0.008, surfZ(0, -0.008) + 0.002);
  nose.scale.set(0.9, 1.5, 1.1);
  add(head, sph(0.017, 12, 10), skin, 0, -0.028, surfZ(0, -0.028) + 0.01);

  // Facial hair is a shell over the lower face with soft, faded edges.
  if (cfg.facial !== 'none') {
    const beard = cfg.facial === 'beard';
    const opacity = { light: 0.16, stubble: 0.5, beard: 1 }[cfg.facial];
    const beardColor = cfg.beard || new THREE.Color(cfg.hair).multiplyScalar(0.8);
    const mat = std(beard ? beardColor : '#3d2a1e', {
      roughness: 1, transparent: true, opacity, alphaMap: fadeMaskTexture(), depthWrite: beard,
    });
    const thetaStart = beard ? 0.53 : 0.57;
    const shell = add(
      head,
      new THREE.SphereGeometry(R * (beard ? 1.04 : 1.012), 28, 14, Math.PI / 2 - 1.35, 2.7, Math.PI * thetaStart, Math.PI * (0.92 - thetaStart)),
      mat,
    );
    shell.scale.set(wide, 1.08, 0.98);
    if (beard) {
      const mustache = add(head, sph(0.03, 14, 8), std(beardColor, { roughness: 1 }), 0, -0.036, surfZ(0, -0.036) - 0.006);
      mustache.scale.set(1.5, 0.42, 0.6);
    }
  }

  const mouthZ = (y) => surfZ(0, y) + (cfg.facial === 'beard' ? 0.009 : 0.001);
  const lip = std('#7a3330', { roughness: 0.6 });
  if (cfg.smile === 'big') {
    const mouth = add(head, new THREE.CircleGeometry(0.04, 20, Math.PI, Math.PI), std('#4a1a18'), 0, -0.05, mouthZ(-0.05) + 0.003);
    mouth.scale.y = 0.9;
    add(head, new THREE.PlaneGeometry(0.064, 0.014), std('#fbfaf5', { roughness: 0.3 }), 0, -0.057, mouthZ(-0.05) + 0.004);
  } else {
    const smile = add(head, new THREE.TorusGeometry(0.032, 0.0065, 8, 16, Math.PI), lip, 0, -0.05, mouthZ(-0.055) - 0.004);
    smile.rotation.z = cfg.smile === 'smirk' ? Math.PI + 0.18 : Math.PI;
    smile.scale.y = 0.6;
  }

  // Hair
  const cap = (theta) => new THREE.SphereGeometry(R * 1.07, 32, 16, 0, Math.PI * 2, 0, theta);
  // Points on the scalp: theta from the crown, phi around (0 = +x, PI/2 = front).
  const scalp = (theta, phi, k) => new THREE.Vector3(
    Math.sin(theta) * Math.cos(phi) * sx * k, Math.cos(theta) * sy * k, Math.sin(theta) * Math.sin(phi) * sz * k,
  );
  const rnd = mulberry32(cfg.id.length * 31 + 7);
  const lump = sph(1, 12, 8);
  if (cfg.hairStyle === 'short') {
    const c = add(head, cap(Math.PI * 0.5), hair, 0, 0.012, -0.006);
    c.scale.set(0.95, 1.06, 1.0);
    c.rotation.x = -0.6;
    // Short textured top with a little volume at the front.
    for (let i = 0; i < 26; i++) {
      const theta = rnd() * Math.PI * 0.36, phi = rnd() * Math.PI * 2;
      const p = scalp(theta, phi, 1.04);
      const l = add(head, lump, hair, p.x, p.y + 0.008, p.z - 0.01);
      l.scale.set(0.045, 0.022, 0.045);
      l.lookAt(p.clone().multiplyScalar(3));
    }
    for (let i = -2; i <= 2; i++) {
      const p = scalp(Math.PI * 0.3, Math.PI / 2 + i * 0.28, 1.03);
      const l = add(head, lump, hair, p.x, p.y + 0.012, p.z);
      l.scale.set(0.04, 0.026, 0.03);
    }
  } else if (cfg.hairStyle === 'curly') {
    const c = add(head, cap(Math.PI * 0.5), hair, 0, 0.01, -0.006);
    c.scale.set(wide * 1.04, 1.08, 1.0);
    c.rotation.x = -0.55;
    const tilt = new THREE.Matrix4().makeRotationX(-0.55);
    for (let i = 0; i < 230; i++) {
      const theta = rnd() * Math.PI * 0.52, phi = rnd() * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)).applyMatrix4(tilt);
      const k = 1.05 + rnd() * 0.12 + (theta < 0.8 ? 0.06 : 0);
      const curl = add(head, lump, hair, dir.x * sx * k, dir.y * sy * k + 0.012, dir.z * sz * k);
      curl.scale.setScalar(0.021 + rnd() * 0.014);
    }
  } else if (cfg.hairStyle === 'swept') {
    const c = add(head, cap(Math.PI * 0.48), hair, 0, 0.012, -0.008);
    c.scale.set(0.95, 1.06, 1.0);
    c.rotation.x = -0.5;
    // Lift at the front, then lighter combed-back streaks over the top.
    const quiff = add(head, lump, hair, 0, sy * 0.86, sz * 0.42);
    quiff.scale.set(0.115, 0.05, 0.075);
    quiff.rotation.x = -0.55;
    const light = std(new THREE.Color(cfg.hair).multiplyScalar(1.3), { roughness: 1 });
    for (let i = 0; i < 5; i++) {
      for (const theta of [0.15, 0.45]) {
        const p = scalp(theta, Math.PI / 2 + (i - 2) * 0.35, 1.06);
        const s = add(head, lump, light, p.x * 0.8, p.y + 0.006, p.z);
        s.scale.set(0.009, 0.006, 0.045);
        s.rotation.x = theta;
      }
    }
  }

  if (cfg.crown) {
    const gold = std('#e3b53b', { metalness: 0.85, roughness: 0.28, emissive: '#3a2a05' });
    const crown = new THREE.Group();
    crown.position.set(0, sy + 0.035, -0.01);
    crown.rotation.set(-0.12, 0, 0.12);
    head.add(crown);
    add(crown, new THREE.CylinderGeometry(0.115, 0.105, 0.06, 28, 1, true), new THREE.MeshStandardMaterial({
      color: '#e3b53b', metalness: 0.85, roughness: 0.28, emissive: '#3a2a05', side: THREE.DoubleSide,
    }));
    const gems = [std('#c0182c', { roughness: 0.2 }), std('#1f4fd6', { roughness: 0.2 })];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(crown, new THREE.ConeGeometry(0.024, 0.07, 8), gold, Math.sin(a) * 0.112, 0.06, Math.cos(a) * 0.112);
      add(crown, sph(0.011, 8, 6), gold, Math.sin(a) * 0.112, 0.1, Math.cos(a) * 0.112);
      add(crown, sph(0.013, 10, 8), gems[i % 2], Math.sin(a) * 0.118, 0, Math.cos(a) * 0.118);
    }
  }
}

// phase: walk cycle angle, move: 0..1 how much walking, run: 0..1 sprint blend.
export function poseAvatar(av, phase, move, run, t) {
  const amp = move * (0.45 + 0.4 * run);
  const s = Math.sin(phase), c = Math.cos(phase);
  av.legs[0].hip.rotation.x = s * amp;
  av.legs[1].hip.rotation.x = -s * amp;
  av.legs[0].knee.rotation.x = 0.05 + Math.max(0, -c) * amp * 1.6;
  av.legs[1].knee.rotation.x = 0.05 + Math.max(0, c) * amp * 1.6;
  // Sprinting is a full Naruto run: arms swept straight back, body leaning way forward.
  const naruto = run * move;
  const flutter = Math.sin(t * 30) * 0.08;
  av.arms[0].shoulder.rotation.x = THREE.MathUtils.lerp(-s * amp * 0.9, 1.35 + flutter, naruto);
  av.arms[1].shoulder.rotation.x = THREE.MathUtils.lerp(s * amp * 0.9, 1.35 - flutter, naruto);
  const elbow = -0.12 * (1 - naruto);
  av.arms[0].elbow.rotation.x = elbow;
  av.arms[1].elbow.rotation.x = elbow;
  av.torso.rotation.x = 0.55 * naruto;
  av.head.rotation.x = -0.35 * naruto;
  av.torso.rotation.y = s * 0.08 * amp;
  av.body.position.y = Math.abs(c) * 0.05 * move;
  const breathe = Math.sin(t * 2.2) * 0.012 * (1 - move);
  av.torso.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
  av.head.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - move);
}

