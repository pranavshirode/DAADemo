/**
 * pipeline.js — Coordinate the four algorithm stages and produce route plans.
 *
 * Stage 1: Dijkstra shortest paths from depot
 * Stage 2: Knapsack stop selection within time budget
 * Stage 3: TSP tour ordering of selected stops
 * Stage 4: Multi-bus scheduling via graph coloring
 */

import {
  STOPS, DEPOT_ID, ROADS,
  buildAdjacency, cloneStops,
  DEFAULT_AVG_SPEED_KMPH,
  DEFAULT_TIME_BUDGET_MIN,
  DEFAULT_NUM_BUSES,
  DEFAULT_SAFETY_BUFFER_MIN,
} from './data.js';

import {
  dijkstra, reconstructPath, allPairsShortestPaths,
  greedyKnapsack, dpKnapsack,
  tspHeldKarp,
  buildConflictGraph, graphColoring,
} from './algorithms.js';

// ── Pipeline state ──────────────────────────────────────────────────

export class Pipeline {
  constructor() {
    this.speed = DEFAULT_AVG_SPEED_KMPH;
    this.timeBudget = DEFAULT_TIME_BUDGET_MIN;
    this.numBuses = DEFAULT_NUM_BUSES;
    this.safetyBuffer = DEFAULT_SAFETY_BUFFER_MIN;
    this.weightKey = 'dist'; // 'dist' or 'travelMin'

    this.adj = null;
    this.stops = null;

    // Results per stage
    this.stage1 = null;
    this.stage2 = null;
    this.stage3 = null;
    this.stage4 = null;
  }

  /** Reset and rebuild adjacency from current speed. */
  init() {
    this.adj = buildAdjacency(this.speed);
    this.stops = cloneStops();
  }

  // ── Stage 1: Dijkstra ──────────────────────────────────────────

  runStage1() {
    if (!this.adj) this.init();
    const result = dijkstra(this.adj, DEPOT_ID, this.weightKey);
    const paths = {};
    for (let i = 0; i < STOPS.length; i++) {
      paths[i] = reconstructPath(result.prev, i);
    }

    // Also compute all-pairs for later stages
    const apsp = allPairsShortestPaths(this.adj, this.weightKey);

    this.stage1 = {
      ...result,
      paths,
      allPairsDist: apsp.distMatrix,
      allPairsPrev: apsp.prevMatrix,
    };
    return this.stage1;
  }

  // ── Stage 2: Knapsack ──────────────────────────────────────────

  runStage2() {
    if (!this.stage1) this.runStage1();

    // Time cost per stop = travel time from depot (shortest) + halt duration
    // This is a simplification for the knapsack model.
    const apspTime = allPairsShortestPaths(this.adj, 'travelMin');

    const items = this.stops
      .filter(s => !s.isDepot)
      .map(s => ({
        id: s.id,
        name: s.name,
        demand: s.demand,
        halt: s.halt,
        travelFromDepot: apspTime.distMatrix[DEPOT_ID][s.id],
        timeCost: apspTime.distMatrix[DEPOT_ID][s.id] + s.halt,
      }));

    const greedy = greedyKnapsack(items, this.timeBudget);
    const dp = dpKnapsack(items, this.timeBudget);

    this.stage2 = {
      items,
      greedy,
      dp,
      useDpResult: true, // UI can toggle
      selectedIds: dp.selected,
    };
    return this.stage2;
  }

  // ── Stage 3: TSP ───────────────────────────────────────────────

  runStage3() {
    if (!this.stage2) this.runStage2();

    // Use all-pairs shortest distances (actual road network)
    const apspDist = allPairsShortestPaths(this.adj, 'dist');
    const apspTime = allPairsShortestPaths(this.adj, 'travelMin');

    const selectedIds = this.stage2.selectedIds;
    const tourNodes = [DEPOT_ID, ...selectedIds];

    const tspResult = tspHeldKarp(tourNodes, apspDist.distMatrix, DEPOT_ID);

    // Compute detailed timing for the tour
    let totalTravelTime = 0;
    let totalHaltTime = 0;
    let totalDist = 0;
    const tourDetails = [];

    if (tspResult.tour.length > 1) {
      for (let i = 0; i < tspResult.tour.length - 1; i++) {
        const from = tspResult.tour[i];
        const to = tspResult.tour[i + 1];
        const segDist = apspDist.distMatrix[from][to];
        const segTime = apspTime.distMatrix[from][to];
        const halt = this.stops[to].halt || 0;
        totalDist += segDist;
        totalTravelTime += segTime;
        totalHaltTime += halt;

        // Reconstruct the actual road path for this segment
        const roadPath = reconstructPath(apspDist.prevMatrix[from], to);

        tourDetails.push({
          from,
          to,
          dist: segDist,
          travelTime: segTime,
          halt,
          roadPath,
        });
      }
    }

    const totalDuration = totalTravelTime + totalHaltTime;
    const feasible = totalDuration <= this.timeBudget;

    this.stage3 = {
      tsp: tspResult,
      tour: tspResult.tour,
      tourDetails,
      totalDist,
      totalTravelTime,
      totalHaltTime,
      totalDuration,
      feasible,
      apspDist: apspDist.distMatrix,
      apspPrev: apspDist.prevMatrix,
      apspTimeDist: apspTime.distMatrix,
    };
    return this.stage3;
  }

  // ── Stage 4: Multi-bus scheduling ──────────────────────────────

  runStage4() {
    if (!this.stage3) this.runStage3();

    const selectedIds = this.stage2.selectedIds;
    const numBuses = this.numBuses;

    // Build conflict graph based on nominal service time windows + safety buffer
    const schedules = selectedIds.map(id => ({
      id,
      name: this.stops[id].name,
      start: this.stops[id].start,
      end: this.stops[id].end,
      haltMin: this.stops[id].halt,
    }));

    const conflictGraph = buildConflictGraph(schedules, this.safetyBuffer);

    if (numBuses === 1) {
      // Single bus — check conflicts and TSP feasibility
      let conflictCount = 0;
      const conflictList = [];
      for (const [id, neighbors] of conflictGraph.entries()) {
        for (const nb of neighbors) {
          if (id < nb) {
            conflictCount++;
            conflictList.push(`${this.stops[id].name} [${this.stops[id].start}–${this.stops[id].end}m] ⚡ ${this.stops[nb].name} [${this.stops[nb].start}–${this.stops[nb].end}m]`);
          }
        }
      }

      const timeFeasible = this.stage3.feasible;
      const isFeasible = timeFeasible && conflictCount === 0;

      let infeasibleReason = null;
      if (!isFeasible) {
        if (conflictCount > 0) {
          infeasibleReason = `1 bus cannot cover ${conflictCount} overlapping stop window(s). At least 2 or 3 buses required.`;
        } else {
          infeasibleReason = `Tour duration (${this.stage3.totalDuration.toFixed(1)}m) exceeds time budget (${this.timeBudget}m).`;
        }
      }

      const busRoutes = [{
        busId: 0,
        color: 0,
        stops: this.stage3.tour,
        details: this.stage3.tourDetails,
        totalDist: this.stage3.totalDist,
        totalTime: this.stage3.totalDuration,
        demand: selectedIds.reduce((s, id) => s + this.stops[id].demand, 0),
      }];

      this.stage4 = {
        numBuses: 1,
        busRoutes,
        coloringResult: null,
        conflictGraph,
        conflictList,
        feasible: isFeasible,
        infeasibleReason,
        totalDemand: busRoutes[0].demand,
        events: [{ type: 'single_bus', tour: this.stage3.tour }],
      };
      return this.stage4;
    }

    const colorResult = graphColoring(selectedIds, conflictGraph, numBuses);

    if (!colorResult.coloring) {
      const conflictList = [];
      for (const [id, neighbors] of conflictGraph.entries()) {
        for (const nb of neighbors) {
          if (id < nb) {
            conflictList.push(`${this.stops[id].name} [${this.stops[id].start}–${this.stops[id].end}m] ⚡ ${this.stops[nb].name} [${this.stops[nb].start}–${this.stops[nb].end}m]`);
          }
        }
      }

      this.stage4 = {
        numBuses,
        busRoutes: [],
        coloringResult: colorResult,
        conflictGraph,
        feasible: false,
        infeasibleReason: `Graph coloring with ${numBuses} bus(es) found ${conflictList.length} conflict(s) under safety buffer ${this.safetyBuffer}m. Overlapping time windows require more buses.`,
        conflictList,
        totalDemand: selectedIds.reduce((s, id) => s + this.stops[id].demand, 0),
        events: colorResult.events,
      };
      return this.stage4;
    }

    // Group stops by bus color
    const groups = new Map();
    for (let b = 0; b < numBuses; b++) groups.set(b, []);
    for (const [stopId, color] of colorResult.coloring) {
      groups.get(color).push(stopId);
    }

    // Build route for each bus
    const busRoutes = [];
    const apspDist = this.stage3.apspDist;
    const apspPrev = this.stage3.apspPrev;
    const apspTime = this.stage3.apspTimeDist;

    for (const [busId, stopIds] of groups) {
      if (stopIds.length === 0) {
        busRoutes.push({
          busId,
          color: busId,
          stops: [DEPOT_ID, DEPOT_ID],
          details: [],
          totalDist: 0,
          totalTime: 0,
          demand: 0,
        });
        continue;
      }

      // Run mini-TSP for this bus's stops
      const miniNodes = [DEPOT_ID, ...stopIds];
      const miniTsp = tspHeldKarp(miniNodes, apspDist, DEPOT_ID);

      let busDist = 0;
      let busTime = 0;
      let busDemand = 0;
      const details = [];

      for (let i = 0; i < miniTsp.tour.length - 1; i++) {
        const from = miniTsp.tour[i];
        const to = miniTsp.tour[i + 1];
        const segDist = apspDist[from][to];
        const segTime = apspTime[from][to];
        const halt = this.stops[to].halt || 0;
        busDist += segDist;
        busTime += segTime + halt;
        busDemand += this.stops[to].demand || 0;

        const roadPath = reconstructPath(apspPrev[from], to);
        details.push({ from, to, dist: segDist, travelTime: segTime, halt, roadPath });
      }

      busRoutes.push({
        busId,
        color: busId,
        stops: miniTsp.tour,
        details,
        totalDist: busDist,
        totalTime: busTime,
        demand: busDemand,
      });
    }

    const allFeasible = busRoutes.every(br => br.totalTime <= this.timeBudget);

    this.stage4 = {
      numBuses,
      busRoutes,
      coloringResult: colorResult,
      conflictGraph,
      feasible: allFeasible,
      infeasibleReason: allFeasible ? null : 'One or more bus routes exceed the time budget.',
      totalDemand: selectedIds.reduce((s, id) => s + this.stops[id].demand, 0),
      events: colorResult.events,
    };
    return this.stage4;
  }

  /** Simple round-robin partition fallback. */
  _fallbackPartition(stopIds, numBuses) {
    const apspDist = this.stage3.apspDist;
    const apspPrev = this.stage3.apspPrev;
    const apspTime = this.stage3.apspTimeDist;
    const groups = Array.from({ length: numBuses }, () => []);
    stopIds.forEach((id, i) => groups[i % numBuses].push(id));

    return groups.map((stops, busId) => {
      if (stops.length === 0) {
        return { busId, color: busId, stops: [DEPOT_ID, DEPOT_ID], details: [], totalDist: 0, totalTime: 0, demand: 0 };
      }
      const miniNodes = [DEPOT_ID, ...stops];
      const miniTsp = tspHeldKarp(miniNodes, apspDist, DEPOT_ID);
      let busDist = 0, busTime = 0, busDemand = 0;
      const details = [];
      for (let i = 0; i < miniTsp.tour.length - 1; i++) {
        const from = miniTsp.tour[i];
        const to = miniTsp.tour[i + 1];
        busDist += apspDist[from][to];
        busTime += apspTime[from][to] + (this.stops[to].halt || 0);
        busDemand += this.stops[to].demand || 0;
        details.push({
          from, to,
          dist: apspDist[from][to],
          travelTime: apspTime[from][to],
          halt: this.stops[to].halt || 0,
          roadPath: reconstructPath(apspPrev[from], to),
        });
      }
      return { busId, color: busId, stops: miniTsp.tour, details, totalDist: busDist, totalTime: busTime, demand: busDemand };
    });
  }

  /** Recompute from a given stage onward. */
  recompute(fromStage = 1) {
    this.init();
    if (fromStage <= 1) { this.stage1 = null; this.stage2 = null; this.stage3 = null; this.stage4 = null; }
    if (fromStage <= 2) { this.stage2 = null; this.stage3 = null; this.stage4 = null; }
    if (fromStage <= 3) { this.stage3 = null; this.stage4 = null; }
    if (fromStage <= 4) { this.stage4 = null; }

    this.runStage1();
    this.runStage2();
    this.runStage3();
    this.runStage4();
  }

  /** Get summary statistics. */
  getSummary() {
    if (!this.stage4) return null;
    return {
      totalStops: this.stage2.selectedIds.length,
      totalDemand: this.stage4.totalDemand,
      numBuses: this.numBuses,
      feasible: this.stage4.feasible,
      buses: this.stage4.busRoutes.map(br => ({
        busId: br.busId,
        stops: br.stops.map(id => this.stops[id].name),
        dist: br.totalDist.toFixed(1),
        time: br.totalTime.toFixed(1),
        demand: br.demand,
      })),
    };
  }
}

