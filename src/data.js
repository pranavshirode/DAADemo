/**
 * data.js — PMPML Smart Route Planner demonstration data.
 *
 * ⚠  All distances, travel times, demand values and halt durations are
 *    illustrative and do NOT represent verified official PMPML data.
 *    The geographic layout is inspired by Pune–PCMC geography but is
 *    simplified for educational purposes.
 */

// ── Stop definitions ────────────────────────────────────────────────
// Positions are approximate XZ coordinates on the 3D map (arbitrary units).
// Y is up; positions are laid out so the network loosely resembles
// the real-world relative positions of these areas.

export const STOPS = [
  { id: 0,  name: 'Nigdi Depot',    x: -40, z: -40, demand: 0,   halt: 0,  isDepot: true,  start: 0,  end: 180 },
  { id: 1,  name: 'Bhosari',        x: -20, z: -50, demand: 120, halt: 2,                 start: 10, end: 25 },
  { id: 2,  name: 'Pimpri',         x: -15, z: -25, demand: 200, halt: 3,                 start: 12, end: 28 },
  { id: 3,  name: 'Wakad',          x:   5, z: -10, demand: 180, halt: 2,                 start: 30, end: 45 },
  { id: 4,  name: 'Hinjewadi',      x:  25, z: -20, demand: 300, halt: 3,                 start: 32, end: 48 },
  { id: 5,  name: 'Aundh',          x:  15, z:  10, demand: 160, halt: 2,                 start: 35, end: 50 },
  { id: 6,  name: 'Shivajinagar',   x:  10, z:  30, demand: 250, halt: 3,                 start: 50, end: 68 },
  { id: 7,  name: 'Pune Station',   x:  20, z:  45, demand: 280, halt: 4,                 start: 52, end: 70 },
  { id: 8,  name: 'Swargate',       x:   5, z:  55, demand: 220, halt: 3,                 start: 55, end: 72 },
  { id: 9,  name: 'Hadapsar',       x:  35, z:  60, demand: 190, halt: 3,                 start: 72, end: 88 },
];
export const DEPOT_ID = 0;

// ── Road connections (bidirectional) ────────────────────────────────
// Each edge: [fromId, toId, distanceKm]

export const ROADS = [
  [0, 2,  7],   // Nigdi – Pimpri
  [0, 1,  8],   // Nigdi – Bhosari
  [1, 2,  8],   // Bhosari – Pimpri
  [2, 3,  8],   // Pimpri – Wakad
  [3, 4,  5],   // Wakad – Hinjewadi
  [3, 5,  8],   // Wakad – Aundh
  [4, 5, 10],   // Hinjewadi – Aundh
  [5, 6,  6],   // Aundh – Shivajinagar
  [2, 6, 14],   // Pimpri – Shivajinagar
  [6, 7,  4],   // Shivajinagar – Pune Station
  [7, 8,  5],   // Pune Station – Swargate
  [6, 8,  7],   // Shivajinagar – Swargate
  [7, 9,  9],   // Pune Station – Hadapsar
  [8, 9, 10],   // Swargate – Hadapsar
];

// ── Configurable parameters ─────────────────────────────────────────

export const DEFAULT_AVG_SPEED_KMPH = 25;        // km/h
export const DEFAULT_TIME_BUDGET_MIN = 90;        // minutes
export const DEFAULT_NUM_BUSES = 3;
export const DEFAULT_SAFETY_BUFFER_MIN = 5;       // minutes between bus visits

// ── Helper: build adjacency list with computed travel times ─────────

/**
 * Build an adjacency list from ROADS.
 * Each entry: { to, dist, travelMin }
 * travelMin = (dist / speed) * 60   (does NOT include halt)
 */
export function buildAdjacency(speedKmph = DEFAULT_AVG_SPEED_KMPH) {
  const adj = STOPS.map(() => []);
  for (const [a, b, dist] of ROADS) {
    const travelMin = (dist / speedKmph) * 60;
    adj[a].push({ to: b, dist, travelMin });
    adj[b].push({ to: a, dist, travelMin });
  }
  return adj;
}

/**
 * Build a simple distance matrix (Infinity where no direct edge exists).
 */
export function buildDistMatrix() {
  const n = STOPS.length;
  const mat = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) mat[i][i] = 0;
  for (const [a, b, d] of ROADS) {
    mat[a][b] = d;
    mat[b][a] = d;
  }
  return mat;
}

/**
 * Build a travel-time matrix (minutes) from distances and speed.
 */
export function buildTimeMatrix(speedKmph = DEFAULT_AVG_SPEED_KMPH) {
  const n = STOPS.length;
  const mat = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) mat[i][i] = 0;
  for (const [a, b, d] of ROADS) {
    const t = (d / speedKmph) * 60;
    mat[a][b] = t;
    mat[b][a] = t;
  }
  return mat;
}

/**
 * Return a mutable deep-copy of STOPS so algorithms can modify demand/halt
 * without affecting the original.
 */
export function cloneStops() {
  return STOPS.map(s => ({ ...s }));
}

