/**
 * algorithms.js — Pure algorithm implementations for PMPML Smart Route Planner.
 *
 * Each algorithm records step-by-step events so the UI can replay them.
 * No rendering code here — only computation.
 */

// ═══════════════════════════════════════════════════════════════════
// 1.  DIJKSTRA'S SHORTEST PATH
// ═══════════════════════════════════════════════════════════════════

/**
 * Run Dijkstra from a source node.
 *
 * @param {Array<Array<{to:number, dist:number, travelMin:number}>>} adj
 * @param {number} source
 * @param {'dist'|'travelMin'} weightKey  — which edge weight to minimise
 * @returns {{ dist: number[], prev: number[], events: object[] }}
 */
export function dijkstra(adj, source, weightKey = 'dist') {
  const n = adj.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const visited = new Array(n).fill(false);
  const events = [];

  dist[source] = 0;
  events.push({ type: 'init', source, distances: [...dist] });

  for (let iter = 0; iter < n; iter++) {
    // Pick unvisited node with smallest distance
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && (u === -1 || dist[i] < dist[u])) u = i;
    }
    if (u === -1 || dist[u] === Infinity) break;

    visited[u] = true;
    events.push({ type: 'visit', node: u, dist: dist[u] });

    for (const edge of adj[u]) {
      const alt = dist[u] + edge[weightKey];
      if (alt < dist[edge.to]) {
        events.push({
          type: 'relax',
          from: u,
          to: edge.to,
          oldDist: dist[edge.to],
          newDist: alt,
          edgeWeight: edge[weightKey],
        });
        dist[edge.to] = alt;
        prev[edge.to] = u;
      } else {
        events.push({
          type: 'skip',
          from: u,
          to: edge.to,
          currentDist: dist[edge.to],
          candidate: alt,
        });
      }
    }

    events.push({ type: 'distances', distances: [...dist] });
  }

  events.push({ type: 'done', distances: [...dist], prev: [...prev] });
  return { dist, prev, events };
}

/**
 * Reconstruct path from Dijkstra prev array.
 */
export function reconstructPath(prev, target) {
  const path = [];
  let cur = target;
  while (cur !== -1) {
    path.unshift(cur);
    cur = prev[cur];
  }
  return path;
}

/**
 * Compute all-pairs shortest paths using Dijkstra.
 * Returns { distMatrix, prevMatrix }.
 */
export function allPairsShortestPaths(adj, weightKey = 'dist') {
  const n = adj.length;
  const distMatrix = [];
  const prevMatrix = [];
  for (let i = 0; i < n; i++) {
    const { dist, prev } = dijkstra(adj, i, weightKey);
    distMatrix.push(dist);
    prevMatrix.push(prev);
  }
  return { distMatrix, prevMatrix };
}

// ═══════════════════════════════════════════════════════════════════
// 2.  KNAPSACK  (Greedy + 0/1 DP)
// ═══════════════════════════════════════════════════════════════════

/**
 * Greedy knapsack by demand/time ratio.
 *
 * @param {Array<{id:number, demand:number, timeCost:number}>} items
 * @param {number} capacity  — total time budget for stop visits (minutes)
 * @returns {{ selected: number[], totalDemand: number, totalTime: number, events: object[] }}
 */
export function greedyKnapsack(items, capacity) {
  const events = [];
  // Sort by demand/timeCost ratio descending
  const sorted = items
    .map((it, i) => ({ ...it, ratio: it.timeCost > 0 ? it.demand / it.timeCost : 0, origIdx: i }))
    .sort((a, b) => b.ratio - a.ratio);

  events.push({ type: 'init', sorted: sorted.map(s => ({ id: s.id, ratio: s.ratio.toFixed(2) })), capacity });

  let totalTime = 0;
  let totalDemand = 0;
  const selected = [];
  const rejected = [];

  for (const item of sorted) {
    if (totalTime + item.timeCost <= capacity) {
      selected.push(item.id);
      totalTime += item.timeCost;
      totalDemand += item.demand;
      events.push({
        type: 'select',
        id: item.id,
        demand: item.demand,
        timeCost: item.timeCost,
        ratio: item.ratio,
        totalTime,
        totalDemand,
        remaining: capacity - totalTime,
      });
    } else {
      rejected.push(item.id);
      events.push({
        type: 'reject',
        id: item.id,
        demand: item.demand,
        timeCost: item.timeCost,
        reason: `Adding ${item.timeCost} min would exceed budget (${totalTime}+${item.timeCost} > ${capacity})`,
      });
    }
  }

  events.push({ type: 'done', selected: [...selected], totalDemand, totalTime });
  return { selected, rejected, totalDemand, totalTime, events };
}

/**
 * 0/1 Knapsack via dynamic programming.
 *
 * @param {Array<{id:number, demand:number, timeCost:number}>} items
 * @param {number} capacity  — integer minutes
 * @returns {{ selected: number[], totalDemand: number, totalTime: number, events: object[] }}
 */
export function dpKnapsack(items, capacity) {
  const events = [];
  const n = items.length;
  const cap = Math.floor(capacity);

  // dp[i][w] = max demand using items 0..i-1 with capacity w
  const dp = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));

  events.push({ type: 'init', numItems: n, capacity: cap });

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    const w = Math.ceil(item.timeCost);
    for (let c = 0; c <= cap; c++) {
      if (w <= c && dp[i - 1][c - w] + item.demand > dp[i - 1][c]) {
        dp[i][c] = dp[i - 1][c - w] + item.demand;
      } else {
        dp[i][c] = dp[i - 1][c];
      }
    }
    events.push({
      type: 'row',
      itemIdx: i - 1,
      id: item.id,
      demand: item.demand,
      timeCost: item.timeCost,
      maxAtCapacity: dp[i][cap],
    });
  }

  // Backtrack to find selected items
  const selected = [];
  let totalDemand = dp[n][cap];
  let totalTime = 0;
  let c = cap;
  for (let i = n; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      const item = items[i - 1];
      selected.push(item.id);
      totalTime += item.timeCost;
      c -= Math.ceil(item.timeCost);
      events.push({ type: 'backtrack_select', id: item.id, demand: item.demand, timeCost: item.timeCost });
    }
  }

  selected.reverse();
  const rejected = items.filter(it => !selected.includes(it.id)).map(it => it.id);

  events.push({ type: 'done', selected: [...selected], rejected, totalDemand, totalTime });
  return { selected, rejected, totalDemand, totalTime, events };
}

// ═══════════════════════════════════════════════════════════════════
// 3.  TRAVELLING SALESMAN PROBLEM  (Held–Karp DP)
// ═══════════════════════════════════════════════════════════════════

/**
 * Held–Karp DP for TSP.
 * Finds minimum-cost Hamiltonian cycle through the given nodes,
 * starting and ending at `depot`.
 *
 * @param {number[]} nodeIds         — ids of nodes to visit (includes depot)
 * @param {number[][]} shortestDist  — all-pairs shortest distance matrix
 * @param {number} depot             — depot node id
 * @returns {{ tour: number[], totalDist: number, events: object[] }}
 */
export function tspHeldKarp(nodeIds, shortestDist, depot) {
  const events = [];
  const nodes = [...nodeIds];

  // Map global IDs to local indices 0..m-1
  const depotLocal = nodes.indexOf(depot);
  if (depotLocal === -1) {
    nodes.unshift(depot);
  }
  const m = nodes.length;
  const depotIdx = nodes.indexOf(depot);

  // Build local distance matrix
  const d = Array.from({ length: m }, () => new Array(m).fill(Infinity));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      d[i][j] = shortestDist[nodes[i]][nodes[j]];
    }
  }

  events.push({
    type: 'init',
    nodes: nodes.map((id, idx) => ({ id, localIdx: idx })),
    depot: nodes[depotIdx],
    depotIdx,
  });

  if (m <= 1) {
    events.push({ type: 'done', tour: [depot], totalDist: 0 });
    return { tour: [depot], totalDist: 0, events };
  }

  const FULL = (1 << m) - 1;

  // dp[S][i] = min cost to reach node i, having visited exactly the set S
  // S is a bitmask; bit j set ↔ node j visited.
  const dp = Array.from({ length: 1 << m }, () => new Array(m).fill(Infinity));
  const parent = Array.from({ length: 1 << m }, () => new Array(m).fill(-1));

  dp[1 << depotIdx][depotIdx] = 0;

  let stepsLogged = 0;
  const MAX_LOGGED = 200;  // limit events for large state spaces

  for (let S = 0; S <= FULL; S++) {
    for (let u = 0; u < m; u++) {
      if (!(S & (1 << u))) continue;
      if (dp[S][u] === Infinity) continue;

      for (let v = 0; v < m; v++) {
        if (S & (1 << v)) continue;
        if (d[u][v] === Infinity) continue;
        const newS = S | (1 << v);
        const newCost = dp[S][u] + d[u][v];
        if (newCost < dp[newS][v]) {
          dp[newS][v] = newCost;
          parent[newS][v] = u;

          if (stepsLogged < MAX_LOGGED) {
            events.push({
              type: 'update',
              fromLocal: u,
              fromId: nodes[u],
              toLocal: v,
              toId: nodes[v],
              set: S,
              newSet: newS,
              cost: newCost,
            });
            stepsLogged++;
          }
        } else if (dp[newS][v] < Infinity && stepsLogged < MAX_LOGGED) {
          events.push({
            type: 'prune',
            fromLocal: u,
            fromId: nodes[u],
            toLocal: v,
            toId: nodes[v],
            candidateCost: newCost,
            currentBest: dp[newS][v],
          });
          stepsLogged++;
        }
      }
    }
  }

  // Close the tour: return to depot
  let bestCost = Infinity;
  let lastNode = -1;
  for (let u = 0; u < m; u++) {
    if (u === depotIdx) continue;
    const cost = dp[FULL][u] + d[u][depotIdx];
    if (cost < bestCost) {
      bestCost = cost;
      lastNode = u;
    }
  }

  if (bestCost === Infinity) {
    events.push({ type: 'infeasible', reason: 'No Hamiltonian cycle exists for the selected stops.' });
    return { tour: [], totalDist: Infinity, events };
  }

  // Reconstruct tour
  const tourLocal = [depotIdx];
  let S = FULL;
  let cur = lastNode;
  const visited = [];
  while (cur !== depotIdx) {
    visited.push(cur);
    const prev = parent[S][cur];
    S = S ^ (1 << cur);
    cur = prev;
  }
  visited.reverse();
  for (const v of visited) tourLocal.push(v);
  tourLocal.push(depotIdx);

  const tour = tourLocal.map(i => nodes[i]);

  events.push({
    type: 'done',
    tour: [...tour],
    totalDist: bestCost,
  });

  return { tour, totalDist: bestCost, events };
}

// ═══════════════════════════════════════════════════════════════════
// 4.  GRAPH COLORING  (Backtracking)
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a conflict graph for bus scheduling.
 * Two stops conflict if their service time windows overlap
 * (including a safety buffer).
 *
 * @param {Array<{id:number, start?:number, end?:number, arrivalMin?:number, haltMin?:number}>} stopSchedules
 * @param {number} safetyBuffer  — minutes between visits
 * @returns {Map<number, Set<number>>}  adjacency list of conflicts
 */
export function buildConflictGraph(stopSchedules, safetyBuffer = 5) {
  const conflicts = new Map();
  for (const s of stopSchedules) conflicts.set(s.id, new Set());

  for (let i = 0; i < stopSchedules.length; i++) {
    const a = stopSchedules[i];
    const aStart = a.start !== undefined ? a.start : (a.arrivalMin !== undefined ? a.arrivalMin : 0);
    const aEnd = (a.end !== undefined ? a.end : (a.arrivalMin !== undefined ? a.arrivalMin + (a.haltMin || 0) : 0)) + safetyBuffer;
    for (let j = i + 1; j < stopSchedules.length; j++) {
      const b = stopSchedules[j];
      const bStart = b.start !== undefined ? b.start : (b.arrivalMin !== undefined ? b.arrivalMin : 0);
      const bEnd = (b.end !== undefined ? b.end : (b.arrivalMin !== undefined ? b.arrivalMin + (b.haltMin || 0) : 0)) + safetyBuffer;
      // Overlap check
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.get(a.id).add(b.id);
        conflicts.get(b.id).add(a.id);
      }
    }
  }

  return conflicts;
}

/**
 * Graph coloring using backtracking.
 *
 * @param {number[]} nodeIds
 * @param {Map<number, Set<number>>} conflicts
 * @param {number} numColors
 * @returns {{ coloring: Map<number, number>|null, events: object[] }}
 */
export function graphColoring(nodeIds, conflicts, numColors) {
  const events = [];
  const coloring = new Map();
  const nodes = [...nodeIds];

  events.push({ type: 'init', nodes: [...nodes], numColors });

  function isSafe(node, color) {
    const neighbors = conflicts.get(node) || new Set();
    for (const nb of neighbors) {
      if (coloring.get(nb) === color) return false;
    }
    return true;
  }

  function backtrack(idx) {
    if (idx === nodes.length) {
      events.push({ type: 'solution', coloring: Object.fromEntries(coloring) });
      return true;
    }

    const node = nodes[idx];
    for (let color = 0; color < numColors; color++) {
      events.push({
        type: 'try',
        node,
        color,
        idx,
      });

      if (isSafe(node, color)) {
        coloring.set(node, color);
        events.push({
          type: 'assign',
          node,
          color,
          assignments: Object.fromEntries(coloring),
        });

        if (backtrack(idx + 1)) return true;

        coloring.delete(node);
        events.push({
          type: 'backtrack',
          node,
          color,
        });
      } else {
        events.push({
          type: 'conflict',
          node,
          color,
          conflictsWith: [...(conflicts.get(node) || [])].filter(nb => coloring.get(nb) === color),
        });
      }
    }

    events.push({ type: 'fail', node, idx });
    return false;
  }

  const success = backtrack(0);

  if (!success) {
    events.push({ type: 'infeasible', reason: `Cannot color with ${numColors} colors.` });
    return { coloring: null, events };
  }

  events.push({ type: 'done', coloring: Object.fromEntries(coloring) });
  return { coloring, events };
}

// ═══════════════════════════════════════════════════════════════════
// 5.  BRUTE-FORCE TSP  (for testing small cases)
// ═══════════════════════════════════════════════════════════════════

export function tspBruteForce(nodeIds, shortestDist, depot) {
  const others = nodeIds.filter(id => id !== depot);
  const perms = permutations(others);
  let bestCost = Infinity;
  let bestTour = null;

  for (const perm of perms) {
    let cost = shortestDist[depot][perm[0]];
    for (let i = 0; i < perm.length - 1; i++) {
      cost += shortestDist[perm[i]][perm[i + 1]];
    }
    cost += shortestDist[perm[perm.length - 1]][depot];
    if (cost < bestCost) {
      bestCost = cost;
      bestTour = [depot, ...perm, depot];
    }
  }

  return { tour: bestTour, totalDist: bestCost };
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

