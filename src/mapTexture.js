/**
 * mapTexture.js — Google Maps-style 2D cartographic base map of Pune & Pimpri-Chinchwad (PCMC).
 *
 * Renders an authentic Google Maps light theme (white land, blue rivers, green tekdis/parks,
 * amber highways, white arterial streets, railway lines, and crisp Roboto typography with halos)
 * onto a 2048x2048 canvas, converted into a high-resolution Three.js CanvasTexture.
 */

import * as THREE from 'three';
import { STOPS, DEPOT_ID } from './data.js';

/**
 * Creates a high-resolution 2048x2048 canvas texture in Google Maps light theme.
 *
 * @param {number} canvasSize - Pixel resolution (default 2048)
 * @param {number} worldSize - World units of the ground plane (default 260)
 * @returns {THREE.CanvasTexture}
 */
export function createPuneMapTexture(canvasSize = 2048, worldSize = 260) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');

  // World to canvas coordinate transform
  // World plane has X: [-worldSize/2, worldSize/2], Z: [-worldSize/2, worldSize/2]
  // In Three.js: -Z is North (top of canvas), +Z is South (bottom of canvas)
  // -X is West (left of canvas), +X is East (right of canvas)
  const halfWorld = worldSize / 2;
  const toX = (wx) => ((wx + halfWorld) / worldSize) * canvasSize;
  const toY = (wz) => ((wz + halfWorld) / worldSize) * canvasSize;
  const toDist = (wDist) => (wDist / worldSize) * canvasSize;

  // 1. Google Maps Base Land (Clean Off-White)
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // 2. Urban & Residential Fabric (Crisp White City Blocks)
  drawUrbanFabric(ctx, toX, toY, toDist);

  // 3. Parks, Tekdis & Green Reserves (Google Maps Green #ceead6)
  drawParksAndTekdis(ctx, toX, toY, toDist);

  // 4. Special Zones (Hinjewadi IT Park, Bhosari MIDC, Hadapsar Magarpatta)
  drawSpecialZones(ctx, toX, toY, toDist);

  // 5. Water Bodies (Google Maps Blue #a5c9eb: Pavana, Mula, Mutha, Sangam, Lakes)
  drawWaterBodies(ctx, toX, toY, toDist);

  // 6. Secondary City Street Grid (White Streets with Grey Edges)
  drawSecondaryStreets(ctx, toX, toY, toDist);

  // 7. National Highways & Arterials (Google Maps Amber #fbbc04)
  drawHighwaysAndArterials(ctx, toX, toY, toDist);

  // 8. Suburban Railway Corridor (Pune - Lonavala Central Railway)
  drawRailwayCorridor(ctx, toX, toY, toDist);

  // 9. Municipal Corporation Boundaries (PCMC vs PMC)
  drawMunicipalBoundaries(ctx, toX, toY, toDist);

  // 10. City, District & Landmark Labels (Google Maps Typography with White Halos)
  drawGoogleMapLabels(ctx, toX, toY, toDist);

  // 11. Google Maps UI Elements (Scale Bar, Location Header, Compass)
  drawGoogleMapUI(ctx, canvasSize, toDist);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;

  return texture;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. URBAN FABRIC (White city blocks on Google off-white)
// ─────────────────────────────────────────────────────────────────────────────

function drawUrbanFabric(ctx, toX, toY, toDist) {
  ctx.save();
  ctx.fillStyle = '#ffffff';

  // Major urban density polygons
  const urbanZones = [
    { x: -75, z: -70, w: 70, h: 55 }, // PCMC (Nigdi, Akurdi, Chinchwad, Pimpri)
    { x: -30, z: -62, w: 28, h: 22 }, // Bhosari
    { x: 2,   z: -26, w: 38, h: 24 }, // Wakad & Hinjewadi East
    { x: 4,   z: -2,  w: 22, h: 20 }, // Aundh & Baner
    { x: -2,  z: 22,  w: 32, h: 32 }, // Central Pune (Shivajinagar, Deccan, Peths)
    { x: 14,  z: 38,  w: 24, h: 22 }, // Station, Camp, Koregaon Park
    { x: 0,   z: 50,  w: 26, h: 28 }, // Swargate & Bibwewadi
    { x: 26,  z: 52,  w: 30, h: 24 }, // Hadapsar & Magarpatta
  ];

  for (const z of urbanZones) {
    ctx.fillRect(toX(z.x), toY(z.z), toDist(z.w), toDist(z.h));
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 1;
    ctx.strokeRect(toX(z.x), toY(z.z), toDist(z.w), toDist(z.h));
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PARKS & TEKDIS (Google Maps Park Green #ceead6)
// ─────────────────────────────────────────────────────────────────────────────

function drawParksAndTekdis(ctx, toX, toY, toDist) {
  ctx.save();
  const parks = [
    { name: 'Vetal Tekdi Reserve',       wx: -3, wz: 26, rx: 13, rz: 16 },
    { name: 'Baner Hill Park',           wx:  4, wz:  2, rx:  9, rz: 10 },
    { name: 'Taljai Forest Reserve',     wx: -4, wz: 68, rx: 14, rz: 13 },
    { name: 'Durga Devi Tekdi Park',     wx: -48, wz: -36, rx: 11, rz: 11 },
    { name: 'SPPU Botanical Gardens',   wx: 10, wz: 16, rx:  8, rz:  8 },
    { name: 'Bund Garden & Osho Park',   wx: 22, wz: 38, rx:  7, rz:  6 },
    { name: 'Pashan Bird Sanctuary',     wx:  2, wz: 12, rx:  7, rz:  7 },
  ];

  for (const p of parks) {
    const cx = toX(p.wx);
    const cy = toY(p.wz);
    const rx = toDist(p.rx);
    const ry = toDist(p.rz);

    // Park polygon
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ceead6'; // Google Maps park green
    ctx.fill();
    ctx.strokeStyle = '#a8dab5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner contour for hill texture
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.65, ry * 0.65, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#b7e1cd';
    ctx.fill();

    // Park label
    drawHaloText(ctx, `🌳 ${p.name}`, cx, cy, '14px Roboto, "Segoe UI", sans-serif', '#137333', '#ffffff', 3);
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SPECIAL ZONES (IT Parks & Industrial Estates)
// ─────────────────────────────────────────────────────────────────────────────

function drawSpecialZones(ctx, toX, toY, toDist) {
  ctx.save();

  // Hinjewadi IT Park (Google Soft Blue #e8f0fe)
  const itX = toX(14);
  const itY = toY(-32);
  const itW = toDist(34);
  const itH = toDist(24);
  ctx.fillStyle = '#e8f0fe';
  ctx.fillRect(itX, itY, itW, itH);
  ctx.strokeStyle = '#aecbfa';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(itX, itY, itW, itH);
  drawHaloText(ctx, '🏢 Rajiv Gandhi Infotech Park (Phases 1-3)', itX + itW / 2, itY + 18, 'bold 14px Roboto, sans-serif', '#1967d2', '#ffffff', 3);

  // Bhosari MIDC Industrial Estate (Google Soft Yellow #fef7e0)
  const midcX = toX(-32);
  const midcY = toY(-62);
  const midcW = toDist(26);
  const midcH = toDist(22);
  ctx.fillStyle = '#fef7e0';
  ctx.fillRect(midcX, midcY, midcW, midcH);
  ctx.strokeStyle = '#fdd663';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(midcX, midcY, midcW, midcH);
  drawHaloText(ctx, '🏭 Bhosari MIDC Industrial Area', midcX + midcW / 2, midcY + 18, 'bold 14px Roboto, sans-serif', '#b06000', '#ffffff', 3);

  // Hadapsar / Magarpatta Cyber City (Google Soft Blue)
  const magX = toX(24);
  const magY = toY(48);
  const magW = toDist(32);
  const magH = toDist(24);
  ctx.fillStyle = '#e8f0fe';
  ctx.fillRect(magX, magY, magW, magH);
  ctx.strokeStyle = '#aecbfa';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(magX, magY, magW, magH);
  drawHaloText(ctx, '🏢 Magarpatta Cyber City & SP Infocity', magX + magW / 2, magY + 18, 'bold 14px Roboto, sans-serif', '#1967d2', '#ffffff', 3);

  // Khadki Cantonment Military Area (Soft sage)
  const canX = toX(4);
  const canY = toY(12);
  const canW = toDist(18);
  const canH = toDist(16);
  ctx.fillStyle = '#edf2e8';
  ctx.fillRect(canX, canY, canW, canH);
  ctx.strokeStyle = '#c5d9bc';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(canX, canY, canW, canH);
  ctx.setLineDash([]);
  drawHaloText(ctx, '🎖️ Khadki Cantonment', canX + canW / 2, canY + 16, '13px Roboto, sans-serif', '#596b52', '#ffffff', 3);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WATER BODIES (Google Maps River Blue #a5c9eb)
// ─────────────────────────────────────────────────────────────────────────────

function drawWaterBodies(ctx, toX, toY, toDist) {
  ctx.save();

  // Rivers definition (Pavana, Mula, Mutha, Mula-Mutha)
  const rivers = [
    {
      name: 'Pavana River',
      pts: [[-85, -65], [-60, -52], [-45, -42], [-32, -32], [-22, -18], [-12, -10], [-2, -2], [8, 6], [12, 10]],
      width: 4.5,
    },
    {
      name: 'Mula River',
      pts: [[5, -42], [14, -32], [22, -25], [16, -14], [10, -2], [14, 6], [12, 18], [11, 26], [11, 33]],
      width: 5.0,
    },
    {
      name: 'Mutha River',
      pts: [[-28, 92], [-18, 76], [-10, 62], [-2, 50], [4, 42], [7, 36], [11, 33]],
      width: 5.0,
    },
    {
      name: 'Mula-Mutha River',
      pts: [[11, 33], [16, 36], [22, 38], [30, 42], [38, 46], [48, 52], [62, 58], [80, 64], [100, 70]],
      width: 7.0,
    },
  ];

  for (const r of rivers) {
    const pts = r.pts.map(p => ({ x: toX(p[0]), y: toY(p[1]) }));
    if (pts.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Google Maps River Border
    ctx.strokeStyle = '#7faad1';
    ctx.lineWidth = toDist(r.width) + 2.5;
    ctx.stroke();

    // Google Maps River Water Body
    ctx.strokeStyle = '#a5c9eb';
    ctx.lineWidth = toDist(r.width);
    ctx.stroke();

    // River label in Google Maps italic blue
    const midIdx = Math.floor(pts.length * 0.45);
    const mid = pts[midIdx];
    drawHaloText(ctx, `~ ${r.name} ~`, mid.x, mid.y - 12, 'italic 15px Roboto, sans-serif', '#3975a8', '#ffffff', 4);
  }

  // Sangam Confluence Marker
  const sangX = toX(11);
  const sangY = toY(33);
  ctx.beginPath();
  ctx.arc(sangX, sangY, toDist(4.5), 0, Math.PI * 2);
  ctx.fillStyle = '#a5c9eb';
  ctx.fill();
  ctx.strokeStyle = '#7faad1';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawHaloText(ctx, 'Sangam Confluence', sangX + 22, sangY + 4, 'bold 14px Roboto, sans-serif', '#1a73e8', '#ffffff', 4, 'left');

  // Lakes
  const lakes = [
    { name: 'Pashan Lake',      wx:  2, wz: 12, r: 4.5 },
    { name: 'Katraj Lake',      wx:  5, wz: 84, r: 6.0 },
    { name: 'Bird Valley Lake', wx: -28, wz: -32, r: 3.5 },
  ];

  for (const l of lakes) {
    const lx = toX(l.wx);
    const ly = toY(l.wz);
    const lr = toDist(l.r);

    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fillStyle = '#a5c9eb';
    ctx.fill();
    ctx.strokeStyle = '#7faad1';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawHaloText(ctx, l.name, lx, ly + lr + 14, 'italic 13px Roboto, sans-serif', '#3975a8', '#ffffff', 4);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECONDARY STREETS (White streets with clean grey outlines)
// ─────────────────────────────────────────────────────────────────────────────

function drawSecondaryStreets(ctx, toX, toY, toDist) {
  ctx.save();
  const grids = [
    { minX: -60, maxX: -10, minZ: -55, maxZ: -15, step: 8 },  // PCMC
    { minX: -32, maxX: -6,  minZ: -62, maxZ: -45, step: 7 },  // Bhosari
    { minX: 2,   maxX: 38,  minZ: -28, maxZ: -6,  step: 8 },  // Wakad-Hinjewadi
    { minX: 5,   maxX: 24,  minZ: -2,  maxZ: 18,  step: 6 },  // Aundh-Baner
    { minX: 0,   maxX: 28,  minZ: 22,  maxZ: 50,  step: 5 },  // Central Pune
    { minX: -4,  maxX: 22,  minZ: 50,  maxZ: 75,  step: 6 },  // Swargate
    { minX: 26,  maxX: 48,  minZ: 48,  maxZ: 72,  step: 7 },  // Hadapsar
  ];

  // Pass 1: Street Casing (grey outline)
  ctx.strokeStyle = '#dadce0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const g of grids) {
    for (let x = g.minX; x <= g.maxX; x += g.step) {
      ctx.moveTo(toX(x), toY(g.minZ));
      ctx.lineTo(toX(x), toY(g.maxZ));
    }
    for (let z = g.minZ; z <= g.maxZ; z += g.step) {
      ctx.moveTo(toX(g.minX), toY(z));
      ctx.lineTo(toX(g.maxX), toY(z));
    }
  }
  ctx.stroke();

  // Pass 2: Street Fill (pure white)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HIGHWAYS & ARTERIALS (Google Maps Amber #fbbc04)
// ─────────────────────────────────────────────────────────────────────────────

function drawHighwaysAndArterials(ctx, toX, toY, toDist) {
  ctx.save();

  const highways = [
    {
      name: 'NH-48 (Mumbai-Bengaluru Western Bypass)',
      badge: 'NH 48',
      pts: [[-75, -65], [-50, -45], [-20, -25], [5, -10], [6, 4], [0, 24], [-6, 52], [-2, 85]],
      width: 7,
      color: '#fbbc04',
      casing: '#ea8600',
    },
    {
      name: 'Old Mumbai-Pune Highway',
      badge: 'NH 48A',
      pts: [[-45, -45], [-28, -35], [-15, -25], [-8, -12], [0, 5], [6, 18], [10, 30]],
      width: 6,
      color: '#fbbc04',
      casing: '#ea8600',
    },
    {
      name: 'Pune-Nashik Highway (NH-60)',
      badge: 'NH 60',
      pts: [[-20, -50], [-10, -68], [0, -88]],
      width: 6,
      color: '#fbbc04',
      casing: '#ea8600',
    },
    {
      name: 'Pune-Ahmednagar Road',
      badge: 'SH 27',
      pts: [[20, 45], [35, 35], [55, 25], [80, 15]],
      width: 5.5,
      color: '#ffffff',
      casing: '#dadce0',
    },
    {
      name: 'Pune-Solapur Highway (NH-65)',
      badge: 'NH 65',
      pts: [[5, 55], [20, 56], [35, 60], [55, 68], [85, 78]],
      width: 6.5,
      color: '#fbbc04',
      casing: '#ea8600',
    },
    {
      name: 'Pune-Satara Road',
      badge: 'NH 48S',
      pts: [[5, 55], [5, 72], [4, 95]],
      width: 5.5,
      color: '#fbbc04',
      casing: '#ea8600',
    },
  ];

  for (const hw of highways) {
    const pts = hw.pts.map(p => ({ x: toX(p[0]), y: toY(p[1]) }));
    if (pts.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Casing (Google orange/border)
    ctx.strokeStyle = hw.casing;
    ctx.lineWidth = hw.width + 3;
    ctx.stroke();

    // Fill (Google yellow or white)
    ctx.strokeStyle = hw.color;
    ctx.lineWidth = hw.width;
    ctx.stroke();

    // Center divider dash for yellow highways
    if (hw.color === '#fbbc04') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Google Maps Highway Shield Badge
    const midIdx = Math.floor(pts.length / 2);
    const mid = pts[midIdx];
    drawGoogleHighwayBadge(ctx, mid.x + 8, mid.y - 12, hw.badge);
  }

  ctx.restore();
}

function drawGoogleHighwayBadge(ctx, x, y, badge) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ea8600';
  ctx.lineWidth = 2;
  const bw = 54;
  const bh = 22;
  ctx.beginPath();
  ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 5);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 12px Roboto, sans-serif';
  ctx.fillStyle = '#202124';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, x, y);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SUBURBAN RAILWAY CORRIDOR
// ─────────────────────────────────────────────────────────────────────────────

function drawRailwayCorridor(ctx, toX, toY, toDist) {
  ctx.save();
  const railPts = [
    [-80, -75], [-45, -45], [-28, -35], [-15, -25],
    [-8, -12], [-1, -2], [6, 12], [10, 28],
    [20, 45], [28, 52], [36, 62], [75, 75]
  ];

  const pts = railPts.map(p => ({ x: toX(p[0]), y: toY(p[1]) }));

  // Rail track base
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = '#70757a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Rail cross-ties (alternating black/white dash)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Station dots along rail
  const stations = [
    { name: 'Akurdi',       wx: -42, wz: -42 },
    { name: 'Chinchwad',    wx: -28, wz: -35 },
    { name: 'Pimpri',       wx: -15, wz: -25 },
    { name: 'Khadki',       wx:   6, wz:  12 },
    { name: 'Shivajinagar', wx:  10, wz:  28 },
    { name: 'Pune Jn',      wx:  20, wz:  45 },
    { name: 'Hadapsar',     wx:  36, wz:  62 },
  ];

  for (const st of stations) {
    const sx = toX(st.wx);
    const sy = toY(st.wz);
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#5f6368';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const mid = pts[Math.floor(pts.length * 0.4)];
  drawHaloText(ctx, '🚆 Central Railway Suburban Line', mid.x - 14, mid.y - 12, 'bold 13px Roboto, sans-serif', '#5f6368', '#ffffff', 4, 'right');

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. MUNICIPAL BOUNDARIES (PCMC vs PMC)
// ─────────────────────────────────────────────────────────────────────────────

function drawMunicipalBoundaries(ctx, toX, toY, toDist) {
  ctx.save();

  // PCMC Boundary (Cyan-grey dashed outline)
  ctx.strokeStyle = '#0288d1';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 6]);
  ctx.strokeRect(toX(-85), toY(-80), toDist(85), toDist(75));

  // PMC Boundary (Amber-grey dashed outline)
  ctx.strokeStyle = '#e65100';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 6]);
  ctx.strokeRect(toX(-18), toY(8), toDist(95), toDist(82));

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. GOOGLE MAPS LABELS & TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

function drawGoogleMapLabels(ctx, toX, toY, toDist) {
  ctx.save();

  // Prominent City Headers (Google Maps Charcoal #202124 with White Halo)
  drawHaloText(ctx, 'PIMPRI-CHINCHWAD', toX(-42), toY(-68), 'bold 26px Roboto, "Segoe UI", sans-serif', '#202124', '#ffffff', 5);
  drawHaloText(ctx, 'PUNE', toX(32), toY(22), 'bold 30px Roboto, "Segoe UI", sans-serif', '#202124', '#ffffff', 5);

  // Regional Sub-Districts & Neighborhoods
  const areas = [
    { name: 'Nigdi Pradhikaran',       wx: -42, wz: -32, font: 'bold 15px Roboto, sans-serif', col: '#3c4043' },
    { name: 'Bhosari MIDC',            wx: -20, wz: -56, font: 'bold 15px Roboto, sans-serif', col: '#3c4043' },
    { name: 'Hinjewadi Infotech Park', wx:  28, wz: -24, font: 'bold 16px Roboto, sans-serif', col: '#1a73e8' },
    { name: 'Wakad',                   wx:   5, wz: -14, font: 'bold 15px Roboto, sans-serif', col: '#3c4043' },
    { name: 'Aundh',                   wx:  15, wz:   6, font: 'bold 15px Roboto, sans-serif', col: '#3c4043' },
    { name: 'Baner',                   wx:   6, wz:  -4, font: '14px Roboto, sans-serif',      col: '#5f6368' },
    { name: 'Khadki Cantonment',       wx:  12, wz:  18, font: '14px Roboto, sans-serif',      col: '#5f6368' },
    { name: 'Shivajinagar',            wx:  10, wz:  26, font: 'bold 16px Roboto, sans-serif', col: '#3c4043' },
    { name: 'Deccan Gymkhana',         wx:   4, wz:  44, font: '14px Roboto, sans-serif',      col: '#5f6368' },
    { name: 'Koregaon Park',           wx:  26, wz:  38, font: '14px Roboto, sans-serif',      col: '#5f6368' },
    { name: 'Swargate Hub',            wx:   5, wz:  52, font: 'bold 16px Roboto, sans-serif', col: '#3c4043' },
    { name: 'Hadapsar Magarpatta',     wx:  38, wz:  52, font: 'bold 16px Roboto, sans-serif', col: '#1a73e8' },
    { name: 'Kothrud',                 wx:  -8, wz:  52, font: '14px Roboto, sans-serif',      col: '#5f6368' },
    { name: 'Katraj Gateway',          wx:   5, wz:  86, font: '14px Roboto, sans-serif',      col: '#5f6368' },
  ];

  for (const a of areas) {
    drawHaloText(ctx, a.name, toX(a.wx), toY(a.wz), a.font, a.col, '#ffffff', 4);
  }

  // Famous Heritage Landmarks (POI Stars)
  const landmarks = [
    { name: '★ Shaniwar Wada',    wx:  8, wz: 36 },
    { name: '★ Dagdusheth Temple', wx: 10, wz: 40 },
    { name: '★ Aga Khan Palace',   wx: 30, wz: 32 },
  ];

  for (const lm of landmarks) {
    drawHaloText(ctx, lm.name, toX(lm.wx), toY(lm.wz), 'bold 13px Roboto, sans-serif', '#d93025', '#ffffff', 4, 'left');
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. GOOGLE MAPS UI ACCENTS (Scale Bar, Header Badge, Compass)
// ─────────────────────────────────────────────────────────────────────────────

function drawGoogleMapUI(ctx, canvasSize, toDist) {
  ctx.save();

  // Top-Left Google Maps Location Pill
  const pillW = 380;
  const pillH = 46;
  const px = 24;
  const py = 24;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(px, py, pillW, pillH, 8);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#dadce0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 15px Roboto, "Segoe UI", sans-serif';
  ctx.fillStyle = '#1a73e8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('📍 Pune & PCMC Metropolitan Transit Map', px + 16, py + pillH / 2);

  // Bottom-Left Scale Bar (Google Maps Style)
  const sx = 28;
  const sy = canvasSize - 40;
  const barLen = toDist(10); // 10 km

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#dadce0';
  ctx.lineWidth = 1;
  ctx.fillRect(sx - 10, sy - 24, barLen + 20, 36);
  ctx.strokeRect(sx - 10, sy - 24, barLen + 20, 36);

  // Black and white segmented bar
  ctx.fillStyle = '#000000';
  ctx.fillRect(sx, sy, barLen / 2, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx + barLen / 2, sy, barLen / 2, 4);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, barLen, 4);

  ctx.font = 'bold 11px Roboto, sans-serif';
  ctx.fillStyle = '#3c4043';
  ctx.textAlign = 'center';
  ctx.fillText('0', sx, sy - 6);
  ctx.fillText('5 km', sx + barLen / 2, sy - 6);
  ctx.fillText('10 km', sx + barLen, sy - 6);

  // Compass Rose (Red & Grey Google Maps Compass)
  const cx = canvasSize - 60;
  const cy = 60;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dadce0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Red North Needle
  ctx.beginPath();
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx + 6, cy);
  ctx.lineTo(cx, cy - 3);
  ctx.fillStyle = '#ea4335'; // Google Red
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx - 6, cy);
  ctx.lineTo(cx, cy - 3);
  ctx.fillStyle = '#d93025';
  ctx.fill();

  // Grey South Needle
  ctx.beginPath();
  ctx.moveTo(cx, cy + 18);
  ctx.lineTo(cx + 6, cy);
  ctx.lineTo(cx, cy + 3);
  ctx.fillStyle = '#bdc1c6';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy + 18);
  ctx.lineTo(cx - 6, cy);
  ctx.lineTo(cx, cy + 3);
  ctx.fillStyle = '#9aa0a6';
  ctx.fill();

  ctx.font = 'bold 11px Roboto, sans-serif';
  ctx.fillStyle = '#d93025';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - 19);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: HALO TEXT (Crisp Google Maps Typography)
// ─────────────────────────────────────────────────────────────────────────────

function drawHaloText(ctx, text, x, y, font, fillCol, haloCol = '#ffffff', haloWidth = 4, align = 'center') {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  // White halo
  ctx.strokeStyle = haloCol;
  ctx.lineWidth = haloWidth;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(text, x, y);

  // Crisp foreground text
  ctx.fillStyle = fillCol;
  ctx.fillText(text, x, y);
  ctx.restore();
}
