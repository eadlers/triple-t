import * as THREE from 'three';

// Seeded RNG so maps and hair curls are reproducible per seed.
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function noise(g, w, h, amount, tint = [1, 1, 1]) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n * tint[0];
    d[i + 1] += n * tint[1];
    d[i + 2] += n * tint[2];
  }
  g.putImageData(img, 0, 0);
}

function toTexture(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}

// One tile = 1m wide x full wall height, mono-yellow backrooms wallpaper.
export function wallTexture() {
  const W = 128, H = 384;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#cdb862';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(140,115,40,0.22)';
  for (let x = 0; x < W; x += 32) {
    g.fillRect(x + 2, 0, 2, H);
    g.fillRect(x + 7, 0, 1, H);
  }
  g.strokeStyle = 'rgba(150,125,45,0.28)';
  g.lineWidth = 1.5;
  for (let x = 16; x < W; x += 32) {
    for (let y = 8; y < H; y += 24) {
      g.beginPath();
      g.moveTo(x - 5, y + 4);
      g.lineTo(x, y);
      g.lineTo(x + 5, y + 4);
      g.stroke();
    }
  }
  noise(g, W, H, 18, [1, 1, 0.7]);
  const grime = g.createLinearGradient(0, H * 0.55, 0, H);
  grime.addColorStop(0, 'rgba(70,55,20,0)');
  grime.addColorStop(1, 'rgba(70,55,20,0.38)');
  g.fillStyle = grime;
  g.fillRect(0, H * 0.55, W, H * 0.45);
  g.fillStyle = '#8c7a3e';
  g.fillRect(0, H - 12, W, 12);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, H - 13, W, 2);
  return toTexture(c, 4, 1);
}

// Damp, stained carpet. One tile = 2m.
export function carpetTexture(repeat) {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#9a8547';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,45,15' : '190,170,100'},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 50;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, 'rgba(70,55,20,0.2)');
        gr.addColorStop(1, 'rgba(70,55,20,0)');
        g.fillStyle = gr;
        g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
  }
  noise(g, S, S, 20, [1, 1, 0.6]);
  return toTexture(c, repeat, repeat);
}

// Drop-ceiling tiles. One texture = 2x2 tiles = 2m.
export function ceilingTexture(repeat) {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#d8d0b0';
  g.fillRect(0, 0, S, S);
  noise(g, S, S, 16);
  g.fillStyle = 'rgba(90,80,50,0.2)';
  for (let i = 0; i < 900; i++) g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  g.strokeStyle = '#8f8668';
  g.lineWidth = 4;
  g.strokeRect(0, 0, S, S);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(S / 2, 0);
  g.lineTo(S / 2, S);
  g.moveTo(0, S / 2);
  g.lineTo(S, S / 2);
  g.stroke();
  return toTexture(c, repeat, repeat);
}

export function panelTexture() {
  const [c, g] = makeCanvas(128, 64);
  g.fillStyle = '#fffbe8';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(200,190,150,0.5)';
  g.lineWidth = 1;
  for (let x = 6; x < 128; x += 6) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 64);
    g.stroke();
  }
  for (let y = 6; y < 64; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  g.strokeStyle = '#a49c80';
  g.lineWidth = 6;
  g.strokeRect(0, 0, 128, 64);
  return toTexture(c);
}

// Polished, orange-tan carved wood for Tung.
export function woodTexture() {
  const W = 512, H = 1024;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#c27d43';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x0 = Math.random() * W;
    const amp = 2 + Math.random() * 7;
    const freq = 0.004 + Math.random() * 0.01;
    const ph = Math.random() * 6.28;
    g.strokeStyle = `rgba(${95 + Math.random() * 30},${45 + Math.random() * 20},15,${0.06 + Math.random() * 0.14})`;
    g.lineWidth = 0.6 + Math.random() * 2.4;
    g.beginPath();
    for (let y = -8; y <= H + 8; y += 8) {
      const x = x0 + Math.sin(y * freq + ph) * amp;
      if (y < 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = 60 + Math.random() * (W - 120), y = 100 + Math.random() * (H - 200);
    for (let r = 4; r < 22; r += 4) {
      g.strokeStyle = `rgba(90,45,15,${0.25 - r * 0.008})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x, y, r * 0.7, r * 1.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const sheen = g.createLinearGradient(0, 0, W, 0);
  sheen.addColorStop(0, 'rgba(255,220,170,0)');
  sheen.addColorStop(0.5, 'rgba(255,220,170,0.08)');
  sheen.addColorStop(1, 'rgba(255,220,170,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, W, H);
  noise(g, W, H, 10, [1, 0.8, 0.5]);
  return toTexture(c);
}

// White chess pieces printed on Chomp's hoodie (transparent background).
export function chessPrintTexture() {
  const [c, g] = makeCanvas(256, 128);
  g.fillStyle = '#f4f4f4';
  g.font = 'bold 86px "Apple Symbols", "Segoe UI Symbol", "DejaVu Sans", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♛', 74, 70);
  g.fillText('♚', 128, 62);
  g.fillText('♞', 184, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Li's beige shirt with thin olive vertical stripes.
export function stripeTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#dcd2b6';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#8b8a6c';
  for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 2, 128);
  g.fillStyle = 'rgba(130,130,100,0.45)';
  for (let x = 4; x < 128; x += 8) g.fillRect(x, 0, 1, 128);
  noise(g, 128, 128, 8);
  return toTexture(c, 2, 2);
}

// Doodle of Tung's face for the wall posters.
function drawTungDoodle(g, cx, cy, s) {
  g.fillStyle = '#c47f45';
  g.beginPath();
  g.roundRect(cx - 34 * s, cy - 60 * s, 68 * s, 130 * s, 18 * s);
  g.fill();
  for (const dx of [-14, 14]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(cx + dx * s, cy - 22 * s, 11 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2210';
    g.beginPath();
    g.arc(cx + dx * s, cy - 21 * s, 5 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#6b3a18';
  g.lineWidth = 3 * s;
  g.beginPath();
  g.moveTo(cx, cy - 14 * s);
  g.lineTo(cx - 4 * s, cy + 6 * s);
  g.lineTo(cx + 3 * s, cy + 6 * s);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy + 6 * s, 18 * s, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  g.beginPath();
  g.moveTo(cx - 24 * s, cy - 40 * s);
  g.quadraticCurveTo(cx - 14 * s, cy - 50 * s, cx - 4 * s, cy - 40 * s);
  g.moveTo(cx + 4 * s, cy - 40 * s);
  g.quadraticCurveTo(cx + 14 * s, cy - 50 * s, cx + 24 * s, cy - 40 * s);
  g.stroke();
}

const POSTERS = [
  { title: 'EMPLEADO DEL MES', lines: ['TRIPLE T'], tung: true, bg: '#f3ead2' },
  { title: '¿HAS VISTO ESTE TRONCO?', lines: ['Si lo encuentras,', 'NO lo despiertes'], tung: true, bg: '#fff6c9' },
  { title: 'SAHUR EN', lines: ['5 MINUTOS', '(ya viene)'], bg: '#ffe0d0' },
  { title: 'PROHIBIDO DORMIR', lines: ['durante el sahur.', 'Él SE VA A ENTERAR.'], bg: '#f3ead2' },
  { title: 'SE BUSCA: SALIDA', lines: ['Vista por última', 'vez en 1987'], bg: '#e9f0ff' },
  { title: 'ALFOMBRA MOJADA', lines: ['(siempre está mojada)', 'no preguntes'], bg: '#fff6c9' },
  { title: 'CLUB DE AJEDREZ', lines: ['Sala ∞', 'Trae tu propia salida'], bg: '#f3ead2' },
  { title: 'TRIPLE T', lines: ['EL MUSICAL', '¡noche de estreno!'], tung: true, bg: '#ffd9e8' },
  { title: '¡SONRÍE!', lines: ['Te está grabando', 'la tung-cámara'], bg: '#e2ffe0' },
  { title: 'BAÑO', lines: ['→ → →', '(no está ahí)'], bg: '#e9f0ff' },
  { title: 'CANCHA DE PÁDEL', lines: ['CERRADA', 'por culpa del tronco'], bg: '#ffe0d0' },
  { title: 'SE BUSCA PERSONAL', lines: ['Requisito: tocar', 'tambores a las 3am'], tung: true, bg: '#fff6c9' },
];

export function posterTextures() {
  return POSTERS.map((p) => {
    const W = 256, H = 340;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = p.bg;
    g.fillRect(0, 0, W, H);
    noise(g, W, H, 14);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 6;
    g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#1b1712';
    g.textAlign = 'center';
    let size = 34;
    g.font = `bold ${size}px Impact, Anton, sans-serif`;
    while (g.measureText(p.title).width > W - 36) g.font = `bold ${--size}px Impact, Anton, sans-serif`;
    g.fillText(p.title, W / 2, 56);
    let y = 170 - (p.lines.length - 1) * 23;
    if (p.tung) {
      drawTungDoodle(g, W / 2, 160, 1);
      y = 268;
    }
    for (const line of p.lines) {
      let ls = 26;
      g.font = `${ls}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
      while (g.measureText(line).width > W - 34) g.font = `${--ls}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
      g.fillText(line, W / 2, y);
      y += p.tung ? 30 : 46;
    }
    // Tape
    g.fillStyle = 'rgba(240,235,200,0.7)';
    g.fillRect(W / 2 - 30, 0, 60, 18);
    return toTexture(c);
  });
}

// Alpha mask that fades in from the top edge and both sides (for beard/stubble shells).
export function fadeMaskTexture() {
  const S = 64;
  const [c, g] = makeCanvas(S, S);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = Math.min(1, y / (S * 0.14));
      const u = Math.min(1, Math.min(x, S - 1 - x) / (S * 0.1));
      const a = Math.round(255 * v * u);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = a;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

// Film grain overlay as a data URL for CSS.
export function grainDataURL() {
  const [c, g] = makeCanvas(200, 200);
  const img = g.createImageData(200, 200);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
