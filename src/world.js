import * as THREE from 'three';
import { mulberry32, wallTexture, carpetTexture, ceilingTexture, panelTexture, posterTextures } from './textures.js';

export const CELL = 4;
export const WALL_H = 3;
const WALL_T = 0.3;
const PILLAR = 0.8;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LIGHT_POOL = 6;
const LIGHT_INTENSITY = 9;
const HEMI_INTENSITY = 0.85;
const PANEL_ON = new THREE.Color(1.7, 1.6, 1.3);
const PANEL_OFF = new THREE.Color(0.22, 0.21, 0.17);

// Procedural backrooms on a grid of CELL x CELL rooms. Walls live on the cell edges:
// h[] are walls along z = y*CELL, v[] are walls along x = x*CELL.
export class World {
  constructor(scene, { size = 34, seed = (Math.random() * 2 ** 31) | 0 } = {}) {
    this.scene = scene;
    this.W = size;
    this.H = size;
    this.rand = mulberry32(seed);
    this.globalFlicker = 0;
    this.lightLevel = 1;
    this.onZap = null;
    this.generate();
    this.buildCollision();
    this.buildMeshes();
  }

  hIdx(x, y) { return y * this.W + x; }
  vIdx(x, y) { return y * (this.W + 1) + x; }

  open(x, y, nx, ny) {
    if (nx === x + 1) this.v[this.vIdx(x + 1, y)] = 0;
    else if (nx === x - 1) this.v[this.vIdx(x, y)] = 0;
    else if (ny === y + 1) this.h[this.hIdx(x, y + 1)] = 0;
    else this.h[this.hIdx(x, y)] = 0;
  }

  canPass(x, y, dx, dy) {
    if (dx === 1) return !this.v[this.vIdx(x + 1, y)];
    if (dx === -1) return !this.v[this.vIdx(x, y)];
    if (dy === 1) return !this.h[this.hIdx(x, y + 1)];
    return !this.h[this.hIdx(x, y)];
  }

  generate() {
    const { W, H } = this;
    const r = this.rand;
    this.h = new Uint8Array((H + 1) * W).fill(1);
    this.v = new Uint8Array(H * (W + 1)).fill(1);

    // Perfect maze first (guarantees everything is connected)...
    const visited = new Uint8Array(W * H);
    const sx = (r() * W) | 0, sy = (r() * H) | 0;
    const stack = [[sx, sy]];
    visited[sy * W + sx] = 1;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const nb = [];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !visited[ny * W + nx]) nb.push([nx, ny]);
      }
      if (!nb.length) {
        stack.pop();
        continue;
      }
      const [nx, ny] = nb[(r() * nb.length) | 0];
      this.open(x, y, nx, ny);
      visited[ny * W + nx] = 1;
      stack.push([nx, ny]);
    }

    // ...then knock out walls so it loops like the backrooms instead of a tidy maze.
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (r() < 0.4) this.h[this.hIdx(x, y)] = 0;
    for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) if (r() < 0.4) this.v[this.vIdx(x, y)] = 0;

    // Big open halls.
    const halls = Math.round((W * H) / 75);
    for (let i = 0; i < halls; i++) {
      const rw = 2 + ((r() * 4) | 0), rh = 2 + ((r() * 4) | 0);
      const rx = (r() * (W - rw)) | 0, ry = (r() * (H - rh)) | 0;
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          if (x < rx + rw - 1) this.v[this.vIdx(x + 1, y)] = 0;
          if (y < ry + rh - 1) this.h[this.hIdx(x, y + 1)] = 0;
        }
      }
    }

    // Pillars on corners where no walls meet.
    this.pillars = [];
    for (let y = 1; y < H; y++) {
      for (let x = 1; x < W; x++) {
        const free = !this.h[this.hIdx(x - 1, y)] && !this.h[this.hIdx(x, y)] &&
          !this.v[this.vIdx(x, y - 1)] && !this.v[this.vIdx(x, y)];
        if (free && r() < 0.35) this.pillars.push([x, y]);
      }
    }
  }

  buildCollision() {
    const { W, H } = this;
    const t = WALL_T / 2;
    this.cellBoxes = Array.from({ length: W * H }, () => []);
    // Boxes are registered in every cell within 0.5m so a single-cell lookup covers any radius <= 0.5.
    const add = (minX, maxX, minZ, maxZ) => {
      const b = { minX, maxX, minZ, maxZ };
      const x0 = Math.max(0, Math.floor((minX - 0.5) / CELL)), x1 = Math.min(W - 1, Math.floor((maxX + 0.5) / CELL));
      const z0 = Math.max(0, Math.floor((minZ - 0.5) / CELL)), z1 = Math.min(H - 1, Math.floor((maxZ + 0.5) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.cellBoxes[z * W + x].push(b);
    };
    for (let y = 0; y <= H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.h[this.hIdx(x, y)]) add(x * CELL - t, (x + 1) * CELL + t, y * CELL - t, y * CELL + t);
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x <= W; x++) {
        if (this.v[this.vIdx(x, y)]) add(x * CELL - t, x * CELL + t, y * CELL - t, (y + 1) * CELL + t);
      }
    }
    for (const [x, y] of this.pillars) {
      add(x * CELL - PILLAR / 2, x * CELL + PILLAR / 2, y * CELL - PILLAR / 2, y * CELL + PILLAR / 2);
    }
  }

  buildMeshes() {
    const { W, H } = this;
    const group = new THREE.Group();
    this.group = group;
    this.scene.add(group);

    const wallTex = wallTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92 });
    const segs = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) if (this.h[this.hIdx(x, y)]) segs.push([(x + 0.5) * CELL, y * CELL, false]);
    for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) if (this.v[this.vIdx(x, y)]) segs.push([x * CELL, (y + 0.5) * CELL, true]);
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL + WALL_T, WALL_H, WALL_T), wallMat, segs.length);
    const m = new THREE.Matrix4();
    const q0 = new THREE.Quaternion();
    const q90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    segs.forEach(([x, z, rot], i) => {
      p.set(x, WALL_H / 2, z);
      walls.setMatrixAt(i, m.compose(p, rot ? q90 : q0, one));
    });
    group.add(walls);

    if (this.pillars.length) {
      const pillarTex = wallTex.clone();
      pillarTex.repeat.set(1, 1);
      pillarTex.needsUpdate = true;
      const pillars = new THREE.InstancedMesh(
        new THREE.BoxGeometry(PILLAR, WALL_H, PILLAR),
        new THREE.MeshStandardMaterial({ map: pillarTex, roughness: 0.92 }),
        this.pillars.length,
      );
      this.pillars.forEach(([x, y], i) => {
        p.set(x * CELL, WALL_H / 2, y * CELL);
        pillars.setMatrixAt(i, m.compose(p, q0, one));
      });
      group.add(pillars);
    }

    const sizeX = W * CELL, sizeZ = H * CELL;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      new THREE.MeshStandardMaterial({ map: carpetTexture(sizeX / 2), roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(sizeX / 2, 0, sizeZ / 2);
    group.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      new THREE.MeshStandardMaterial({ map: ceilingTexture(sizeX / 2), roughness: 0.95 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(sizeX / 2, WALL_H, sizeZ / 2);
    group.add(ceiling);

    this.buildPosters(group);

    // Fluorescent panels, a few faulty or dead.
    this.panels = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.rand() > 0.8) continue;
        const roll = this.rand();
        const kind = roll < 0.08 ? 'flicker' : roll < 0.13 ? 'dead' : 'ok';
        this.panels.push({ x: (x + 0.5) * CELL, z: (y + 0.5) * CELL, kind, on: kind === 'dead' ? 0 : 1, timer: this.rand() * 3 });
      }
    }
    this.panelMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.5, 0.04, 0.7),
      new THREE.MeshBasicMaterial({ map: panelTexture() }),
      this.panels.length,
    );
    this.panels.forEach((pl, i) => {
      pl.i = i;
      p.set(pl.x, WALL_H - 0.02, pl.z);
      this.panelMesh.setMatrixAt(i, m.compose(p, q0, one));
      this.panelMesh.setColorAt(i, pl.on ? PANEL_ON : PANEL_OFF);
    });
    group.add(this.panelMesh);
    this.flickerPanels = this.panels.filter((pl) => pl.kind === 'flicker');
    this.litPanels = this.panels.filter((pl) => pl.kind !== 'dead');

    this.hemi = new THREE.HemisphereLight(0xfff3c4, 0x5a4a20, HEMI_INTENSITY);
    group.add(this.hemi);
    this.lights = [];
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xfff0c8, 0, 13, 1.6);
      l.userData.panel = null;
      group.add(l);
      this.lights.push(l);
    }
    this.assignTimer = 0;
  }

  // Joke posters taped to random walls.
  buildPosters(group) {
    const { W, H } = this;
    const mats = posterTextures().map((map) => new THREE.MeshStandardMaterial({ map, roughness: 0.85 }));
    const geo = new THREE.PlaneGeometry(0.6, 0.8);
    const off = WALL_T / 2 + 0.01;
    const count = Math.round((W * H) / 22);
    for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
      const r = this.rand;
      const side = r() < 0.5 ? 1 : -1;
      const along = (r() - 0.5) * 1.8;
      const m = new THREE.Mesh(geo, mats[i % mats.length]);
      if (r() < 0.5) {
        const x = (r() * W) | 0, y = 1 + ((r() * (H - 1)) | 0);
        if (!this.h[this.hIdx(x, y)]) continue;
        m.position.set((x + 0.5) * CELL + along, 1.6, y * CELL + side * off);
        m.rotation.y = side > 0 ? 0 : Math.PI;
      } else {
        const x = 1 + ((r() * (W - 1)) | 0), y = (r() * H) | 0;
        if (!this.v[this.vIdx(x, y)]) continue;
        m.position.set(x * CELL + side * off, 1.6, (y + 0.5) * CELL + along);
        m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      m.rotation.z = (r() - 0.5) * 0.12;
      group.add(m);
      i++;
    }
  }

  updateLights(dt, px, pz) {
    let dirty = false;
    for (const pl of this.flickerPanels) {
      pl.timer -= dt;
      if (pl.timer > 0) continue;
      pl.on = pl.on ? 0 : 1;
      const r = this.rand();
      pl.timer = pl.on ? (r < 0.5 ? 0.05 + r * 0.4 : 0.8 + r * 4) : 0.03 + r * 0.15;
      this.panelMesh.setColorAt(pl.i, pl.on ? PANEL_ON : PANEL_OFF);
      dirty = true;
      const d = Math.hypot(pl.x - px, pl.z - pz);
      if (!pl.on && d < 10 && this.onZap) this.onZap(d);
    }

    let g = 1;
    if (this.globalFlicker > 0) {
      this.globalFlicker -= dt;
      g = Math.random() < 0.45 ? 0.12 : 1;
    }
    this.lightLevel = g;
    this.panelMesh.material.color.setScalar(g < 1 ? 0.2 : 1);
    if (dirty) this.panelMesh.instanceColor.needsUpdate = true;

    this.assignTimer -= dt;
    if (this.assignTimer <= 0) {
      this.assignTimer = 0.2;
      const near = [];
      for (const pl of this.litPanels) {
        const d2 = (pl.x - px) ** 2 + (pl.z - pz) ** 2;
        if (d2 < 15 * 15) near.push([d2, pl]);
      }
      near.sort((a, b) => a[0] - b[0]);
      this.lights.forEach((l, i) => {
        const pl = near[i] ? near[i][1] : null;
        l.userData.panel = pl;
        if (pl) l.position.set(pl.x, WALL_H - 0.25, pl.z);
      });
    }
    for (const l of this.lights) {
      const pl = l.userData.panel;
      l.intensity = pl ? LIGHT_INTENSITY * pl.on * g : 0;
    }
    this.hemi.intensity = HEMI_INTENSITY * (0.3 + 0.7 * g);
  }

  // ---- queries ----

  cellOf(x, z) {
    const cx = Math.min(this.W - 1, Math.max(0, Math.floor(x / CELL)));
    const cz = Math.min(this.H - 1, Math.max(0, Math.floor(z / CELL)));
    return cz * this.W + cx;
  }

  cellCenter(c) {
    return { x: ((c % this.W) + 0.5) * CELL, z: (Math.floor(c / this.W) + 0.5) * CELL };
  }

  boxesNear(x, z) {
    return this.cellBoxes[this.cellOf(x, z)];
  }

  // Push a circle (p.x, p.z, radius <= 0.5) out of all walls.
  collide(p, radius) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.boxesNear(p.x, p.z)) {
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        const dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (radius - d);
          p.z += (dz / d) * (radius - d);
        } else {
          const l = p.x - b.minX, r = b.maxX - p.x, u = p.z - b.minZ, dn = b.maxZ - p.z;
          const mn = Math.min(l, r, u, dn);
          if (mn === l) p.x = b.minX - radius;
          else if (mn === r) p.x = b.maxX + radius;
          else if (mn === u) p.z = b.minZ - radius;
          else p.z = b.maxZ + radius;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }

  blocked(x, z, margin = 0) {
    for (const b of this.boxesNear(x, z)) {
      if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return true;
    }
    return false;
  }

  los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / 0.25);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.blocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  // Line of sight wide enough for a body of the given radius to walk straight along.
  clearLine(ax, az, bx, bz, radius) {
    const d = Math.hypot(bx - ax, bz - az);
    if (d < 1e-3) return true;
    const nx = (-(bz - az) / d) * radius, nz = ((bx - ax) / d) * radius;
    return this.los(ax, az, bx, bz) && this.los(ax + nx, az + nz, bx + nx, bz + nz) && this.los(ax - nx, az - nz, bx - nx, bz - nz);
  }

  bfs(start, goal) {
    const { W, H } = this;
    const prev = new Int32Array(W * H).fill(-1);
    const q = new Int32Array(W * H);
    let qh = 0, qt = 0;
    prev[start] = start;
    q[qt++] = start;
    while (qh < qt) {
      const c = q[qh++];
      if (c === goal) break;
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -1 || !this.canPass(x, y, dx, dy)) continue;
        prev[n] = c;
        q[qt++] = n;
      }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.push(c);
    return path.reverse();
  }

  distances(start) {
    const { W, H } = this;
    const dist = new Int32Array(W * H).fill(-1);
    const q = new Int32Array(W * H);
    let qh = 0, qt = 0;
    dist[start] = 0;
    q[qt++] = start;
    while (qh < qt) {
      const c = q[qh++];
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (dist[n] !== -1 || !this.canPass(x, y, dx, dy)) continue;
        dist[n] = dist[c] + 1;
        q[qt++] = n;
      }
    }
    return dist;
  }

  randomCell() {
    return (this.rand() * this.W * this.H) | 0;
  }
}
