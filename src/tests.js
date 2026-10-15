/**
 * tests.js — Unit tests for algorithms and pipeline.
 * Run with: node src/tests.js
 */

import { buildAdjacency, STOPS, DEPOT_ID, buildDistMatrix } from './data.js';
import {
  dijkstra, reconstructPath, allPairsShortestPaths,
  greedyKnapsack, dpKnapsack,
  tspHeldKarp, tspBruteForce,
  buildConflictGraph, graphColoring,
} from './algorithms.js';
import { Pipeline } from './pipeline.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertClose(a, b, eps, msg) {
  assert(Math.abs(a - b) < eps, `${msg} (got ${a}, expected ≈${b})`);
}

// ── Dijkstra Tests ──────────────────────────────────────────────────

console.log('\n═══ Dijkstra Tests ═══');

const adj = buildAdjacency(25);

{
  const { dist, prev } = dijkstra(adj, DEPOT_ID, 'dist');

  // Nigdi to itself = 0
  assert(dist[DEPOT_ID] === 0, 'Nigdi → Nigdi = 0');

  // Nigdi → Pimpri direct = 7
  assert(dist[2] === 7, 'Nigdi → Pimpri = 7 km');

  // Nigdi → Bhosari direct = 8
  assert(dist[1] === 8, 'Nigdi → Bhosari = 8 km');

  // Nigdi → Wakad = Nigdi→Pimpri(7) + Pimpri→Wakad(8) = 15
  assert(dist[3] === 15, 'Nigdi → Wakad = 15 km');

  // Nigdi → Hinjewadi = 15 + 5 = 20
  assert(dist[4] === 20, 'Nigdi → Hinjewadi = 20 km');

  // Nigdi → Shivajinagar: min(Nigdi→Pimpri→Shivajinagar=21, Nigdi→Pimpri→Wakad→Aundh→Shiv=37)
  // Actually: 7 + 14 = 21 via Pimpri, or 7+8+8+6 = 29 via Wakad→Aundh
  assert(dist[6] === 21, 'Nigdi → Shivajinagar = 21 km');

  // Path reconstruction
  const path = reconstructPath(prev, 6);
  assert(path[0] === DEPOT_ID, 'Path to Shivajinagar starts at depot');
  assert(path[path.length - 1] === 6, 'Path to Shivajinagar ends at Shivajinagar');
}

{
  const { dist } = dijkstra(adj, DEPOT_ID, 'travelMin');
  // Travel time Nigdi→Pimpri = 7/25*60 = 16.8 min
  assertClose(dist[2], 16.8, 0.1, 'Nigdi → Pimpri travel time = 16.8 min');
}

// ── Knapsack Tests ──────────────────────────────────────────────────

console.log('\n═══ Knapsack Tests ═══');

{
  const items = [
    { id: 1, demand: 100, timeCost: 20 },
    { id: 2, demand: 60,  timeCost: 10 },
    { id: 3, demand: 80,  timeCost: 15 },
  ];

  const greedy = greedyKnapsack(items, 30);
  assert(greedy.totalTime <= 30, 'Greedy respects capacity');
  assert(greedy.selected.length > 0, 'Greedy selects at least one item');

  const dp = dpKnapsack(items, 30);
  assert(dp.totalTime <= 30, 'DP respects capacity');
  assert(dp.totalDemand >= greedy.totalDemand, 'DP ≥ greedy demand (optimal)');

  // DP for this specific case: items 2+3 = demand 140, time 25 ≤ 30
  // or items 1+2 = demand 160, time 30 ≤ 30  ← best
  assert(dp.totalDemand === 160, 'DP finds optimal demand = 160');
}

{
  // Edge case: empty
  const dp = dpKnapsack([], 100);
  assert(dp.selected.length === 0, 'Empty items → empty selection');
}

// ── TSP Tests ───────────────────────────────────────────────────────

console.log('\n═══ TSP Tests ═══');

{
  // Small test: 4 nodes with known distances
  const dist4 = [
    [0, 10, 15, 20],
    [10, 0, 35, 25],
    [15, 35, 0, 30],
    [20, 25, 30, 0],
  ];
  const hk = tspHeldKarp([0, 1, 2, 3], dist4, 0);
  const bf = tspBruteForce([0, 1, 2, 3], dist4, 0);

  assert(hk.totalDist === bf.totalDist,
    `Held-Karp matches brute-force (HK=${hk.totalDist}, BF=${bf.totalDist})`);
  assert(hk.tour[0] === 0, 'Tour starts at depot');
  assert(hk.tour[hk.tour.length - 1] === 0, 'Tour ends at depot');
  assert(hk.tour.length === 5, 'Tour visits all 4 nodes + return');
}

{
  // TSP with actual road network (subset of stops)
  const apsp = allPairsShortestPaths(adj, 'dist');
  const nodes = [0, 2, 3]; // Nigdi, Pimpri, Wakad
  const hk = tspHeldKarp(nodes, apsp.distMatrix, 0);
  const bf = tspBruteForce(nodes, apsp.distMatrix, 0);

  assert(hk.totalDist === bf.totalDist,
    `Road-network TSP: HK=${hk.totalDist}, BF=${bf.totalDist}`);
}

{
  // 5-node TSP cross-check
  const dist5 = [
    [0, 3, 4, 2, 7],
    [3, 0, 4, 6, 3],
    [4, 4, 0, 5, 8],
    [2, 6, 5, 0, 6],
    [7, 3, 8, 6, 0],
  ];
  const hk = tspHeldKarp([0,1,2,3,4], dist5, 0);
  const bf = tspBruteForce([0,1,2,3,4], dist5, 0);
  assert(hk.totalDist === bf.totalDist,
    `5-node TSP: HK=${hk.totalDist}, BF=${bf.totalDist}`);
}

// ── Graph Coloring Tests ────────────────────────────────────────────

console.log('\n═══ Graph Coloring Tests ═══');

{
  // Simple triangle — needs 3 colors
  const nodes = [1, 2, 3];
  const conflicts = new Map([
    [1, new Set([2, 3])],
    [2, new Set([1, 3])],
    [3, new Set([1, 2])],
  ]);

  const r2 = graphColoring(nodes, conflicts, 2);
  assert(r2.coloring === null, 'Triangle needs > 2 colors');

  const r3 = graphColoring(nodes, conflicts, 3);
  assert(r3.coloring !== null, 'Triangle colorable with 3');
  // All neighbors have different colors
  for (const [node, color] of r3.coloring) {
    for (const nb of conflicts.get(node)) {
      assert(r3.coloring.get(nb) !== color, `Node ${node} and ${nb} differ`);
    }
  }
}

{
  // No conflicts — 1 color suffices
  const nodes = [1, 2, 3];
  const conflicts = new Map([[1, new Set()], [2, new Set()], [3, new Set()]]);
  const r = graphColoring(nodes, conflicts, 1);
  assert(r.coloring !== null, 'No conflicts → 1 color enough');
}

// ── Conflict Graph Tests ────────────────────────────────────────────

console.log('\n═══ Conflict Graph Tests ═══');

{
  const schedules = [
    { id: 1, arrivalMin: 0,  haltMin: 10 },
    { id: 2, arrivalMin: 8,  haltMin: 10 },  // overlaps with 1
    { id: 3, arrivalMin: 30, haltMin: 5  },   // no overlap
  ];
  const cg = buildConflictGraph(schedules, 5);
  assert(cg.get(1).has(2), 'Stop 1 and 2 conflict (overlap)');
  assert(cg.get(2).has(1), 'Symmetric conflict');
  assert(!cg.get(1).has(3), 'Stop 1 and 3 do not conflict');
}

{
  // Test with nominal service time windows
  const windowStops = [
    { id: 1, start: 10, end: 25 },
    { id: 2, start: 12, end: 28 }, // overlaps with 1
    { id: 3, start: 40, end: 60 }, // no overlap with 1 or 2
  ];
  const cg = buildConflictGraph(windowStops, 2);
  assert(cg.get(1).has(2), 'Window overlap: 1 and 2 conflict');
  assert(!cg.get(1).has(3), 'Window non-overlap: 1 and 3 do not conflict');

  // Buffer sensitivity: increasing buffer creates new overlap
  const cgBuffered = buildConflictGraph(windowStops, 15);
  assert(cgBuffered.get(2).has(3), 'Increased safety buffer creates conflict between 2 and 3');
}

// ── Pipeline Integration Tests ──────────────────────────────────────

console.log('\n═══ Pipeline Tests ═══');

{
  const pipe = new Pipeline();
  pipe.timeBudget = 120;
  pipe.numBuses = 3;
  pipe.safetyBuffer = 3;
  pipe.recompute();

  assert(pipe.stage1 !== null, 'Stage 1 computed');
  assert(pipe.stage2 !== null, 'Stage 2 computed');
  assert(pipe.stage3 !== null, 'Stage 3 computed');
  assert(pipe.stage4 !== null, 'Stage 4 computed');

  // Tour starts and ends at depot
  const tour = pipe.stage3.tour;
  assert(tour[0] === DEPOT_ID, 'Tour starts at depot');
  assert(tour[tour.length - 1] === DEPOT_ID, 'Tour ends at depot');

  // 3-Bus scheduling: verify each bus starts and ends at depot
  assert(pipe.stage4.busRoutes.length === 3, 'Stage 4 created 3 bus routes');
  for (const br of pipe.stage4.busRoutes) {
    assert(br.stops[0] === DEPOT_ID, `Bus ${br.busId} starts at depot`);
    assert(br.stops[br.stops.length - 1] === DEPOT_ID, `Bus ${br.busId} ends at depot`);
    assert(br.totalDist >= 0, `Bus ${br.busId} valid distance: ${br.totalDist} km`);
    assert(br.totalTime >= 0, `Bus ${br.busId} valid duration: ${br.totalTime} min`);
  }

  // Summary works
  const summary = pipe.getSummary();
  assert(summary !== null, 'Summary generated');
  assert(summary.numBuses === 3, 'Summary shows 3 buses');
}

{
  // Test infeasibility reporting when 1 bus cannot cover conflicting stops
  const pipe1 = new Pipeline();
  pipe1.timeBudget = 90;
  pipe1.numBuses = 1;
  pipe1.recompute();

  // If conflicting stops are selected, 1 bus cannot satisfy them
  assert(pipe1.stage4 !== null, 'Stage 4 computed for 1 bus');
  assert(pipe1.stage4.numBuses === 1, 'Stage 4 evaluated with 1 bus');
  if (!pipe1.stage4.feasible) {
    assert(pipe1.stage4.infeasibleReason.length > 0, 'Infeasibility reason clearly provided');
  }
}

// ── Report ──────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(40)}`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

