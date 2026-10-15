/**
 * main.js — Initialize the application and connect UI, algorithms, scene, and animation.
 */

import { Scene3D } from './scene.js';
import { UI } from './ui.js';
import { Pipeline } from './pipeline.js';
import { STOPS, DEPOT_ID } from './data.js';
import { reconstructPath } from './algorithms.js';

// ── Global state ────────────────────────────────────────────────────

let scene, ui, pipeline;
let clock;
let busAnimActive = false;

// ── Initialization ──────────────────────────────────────────────────

function init() {
  // Create pipeline
  pipeline = new Pipeline();
  pipeline.recompute();

  // Create 3D scene
  const container = document.getElementById('three-container');
  scene = new Scene3D(container);

  // Create UI
  ui = new UI();
  ui.setPipeline(pipeline);
  ui.buildUI();

  // Connect callbacks
  ui.onStageChange = handleStageChange;
  ui.onParameterChange = handleParameterChange;
  ui.onStepChange = handleStepChange;
  ui.onReset = handleReset;
  ui.onAction = handleUIAction;

  // Start render loop
  clock = { last: performance.now() };
  animate();
}

// ── Animation loop ──────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = (now - clock.last) / 1000;
  clock.last = now;

  // Update bus animations
  if (busAnimActive) {
    busAnimActive = scene.updateBusAnimations(delta * ui.animSpeed);
  }

  scene.render();
}

// ── Stage change handler ────────────────────────────────────────────

function handleStageChange(stageNum) {
  scene.resetAllHighlights();
  scene.clearBusAnimations();
  busAnimActive = false;
  ui.clearEventLog();

  switch (stageNum) {
    case 1:
      showDijkstraInit();
      break;
    case 2:
      showKnapsackInit();
      break;
    case 3:
      showTSPInit();
      break;
    case 4:
      showSchedulingInit();
      break;
  }
}

// ── Parameter change handler ────────────────────────────────────────

function handleParameterChange(param, value) {
  if (param === 'timeBudget') {
    pipeline.timeBudget = value;
    pipeline.recompute(2);
  } else if (param === 'numBuses') {
    pipeline.numBuses = value;
    pipeline.recompute(4);
  } else if (param === 'safetyBuffer') {
    pipeline.safetyBuffer = value;
    pipeline.recompute(4);
  } else if (param === 'weightKey') {
    pipeline.weightKey = value;
    pipeline.recompute(1);
  } else if (param === 'knapsackMethod') {
    if (pipeline.stage2) {
      pipeline.stage2.useDpResult = (value === 'dp');
      pipeline.stage2.selectedIds = pipeline.stage2.useDpResult
        ? pipeline.stage2.dp.selected
        : pipeline.stage2.greedy.selected;
      pipeline.recompute(3);
    }
  }

  // Refresh current stage
  handleStageChange(ui.currentStage);
}

function handleUIAction(action) {
  if (action === 'autoPrune') {
    // If TSP is infeasible, prune stop with lowest demand until tour fits budget
    if (pipeline.stage3 && !pipeline.stage3.feasible && pipeline.stage2.selectedIds.length > 1) {
      const selected = [...pipeline.stage2.selectedIds];
      selected.sort((a, b) => pipeline.stops[a].demand - pipeline.stops[b].demand);
      const dropped = selected.shift();
      pipeline.stage2.selectedIds = pipeline.stage2.selectedIds.filter(id => id !== dropped);
      pipeline.recompute(3);
      handleStageChange(ui.currentStage);
    }
  }
}

// ── Reset handler ───────────────────────────────────────────────────

function handleReset(what) {
  if (what === 'camera') {
    scene.resetCamera();
  } else if (what === 'mapView') {
    scene.toggleMapView();
  } else if (what === 'stage') {
    handleStageChange(ui.currentStage);
  }
}

// ── Step change handler ─────────────────────────────────────────────

function handleStepChange(stage, stepIdx) {
  switch (stage) {
    case 1: stepDijkstra(stepIdx); break;
    case 2: stepKnapsack(stepIdx); break;
    case 3: stepTSP(stepIdx); break;
    case 4: stepScheduling(stepIdx); break;
  }
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 1: DIJKSTRA
// ═══════════════════════════════════════════════════════════════════

function showDijkstraInit() {
  scene.highlightStop(DEPOT_ID, 0xffab00);
  updateStatsForStage1();
}

function stepDijkstra(stepIdx) {
  const events = pipeline.stage1.events;
  const clampedIdx = ui.renderDijkstraStep(events, stepIdx);
  ui.stepIndex = clampedIdx;

  // Apply visual effects for all events up to this step
  scene.resetAllHighlights();
  scene.highlightStop(DEPOT_ID, 0xffab00);

  for (let i = 0; i <= clampedIdx; i++) {
    const ev = events[i];
    if (ev.type === 'visit') {
      scene.highlightStop(ev.node, ev.node === DEPOT_ID ? 0xffab00 : 0x00ff88);
    }
    if (ev.type === 'relax') {
      scene.highlightEdge(ev.from, ev.to, 0x00e5ff);
      scene.highlightStop(ev.to, 0xff66aa);
    }
  }

  // Update table with current distances
  const currentEvent = events[clampedIdx];
  if (currentEvent.distances) {
    // Distance table is rendered inside renderDijkstraStep
  }

  updateStatsForStage1();
}

function updateStatsForStage1() {
  if (!pipeline.stage1) return;
  const dists = pipeline.stage1.dist;
  const reachable = dists.filter(d => d < Infinity).length;
  const maxDist = Math.max(...dists.filter(d => d < Infinity));
  const isTime = pipeline.weightKey === 'travelMin';
  const unit = isTime ? ' min' : ' km';
  ui.updateStats({
    stops: reachable + '/' + STOPS.length,
    demand: '—',
    dist: maxDist.toFixed(1) + unit + ' (max)',
    duration: '—',
    status: 'Exploring',
    statusClass: 'status-active',
  });
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 2: KNAPSACK
// ═══════════════════════════════════════════════════════════════════

function showKnapsackInit() {
  // Highlight selected stops
  const selected = pipeline.stage2.selectedIds;
  for (const id of selected) {
    scene.highlightStop(id, 0x00ff88);
  }
  scene.highlightStop(DEPOT_ID, 0xffab00);

  // Show table with comparison
  ui.renderKnapsackTable(pipeline.stage2.items, selected, pipeline.stage2.greedy, pipeline.stage2.dp);
  updateStatsForStage2();
}

function stepKnapsack(stepIdx) {
  const s2 = pipeline.stage2;
  const clampedIdx = ui.renderKnapsackStep(
    s2.greedy.events,
    s2.dp.events,
    stepIdx,
    s2.useDpResult
  );
  ui.stepIndex = clampedIdx;

  // Visual: highlight selected stops progressively
  scene.resetAllHighlights();
  scene.highlightStop(DEPOT_ID, 0xffab00);

  const events = s2.useDpResult ? s2.dp.events : s2.greedy.events;
  for (let i = 0; i <= clampedIdx; i++) {
    const ev = events[i];
    if (ev.type === 'select') {
      scene.highlightStop(ev.id, 0x00ff88);
    } else if (ev.type === 'reject') {
      scene.highlightStop(ev.id, 0xff4444);
    } else if (ev.type === 'backtrack_select') {
      scene.highlightStop(ev.id, 0x00ff88);
    }
  }

  // Update table on completion
  const currentEvent = events[clampedIdx];
  if (currentEvent.type === 'done') {
    ui.renderKnapsackTable(s2.items, currentEvent.selected, s2.greedy, s2.dp);
  }

  updateStatsForStage2();
}

function updateStatsForStage2() {
  if (!pipeline.stage2) return;
  const s2 = pipeline.stage2;
  const result = s2.useDpResult ? s2.dp : s2.greedy;
  ui.updateStats({
    stops: result.selected.length + '/' + s2.items.length,
    demand: result.totalDemand,
    dist: '—',
    duration: result.totalTime.toFixed(1) + ' / ' + pipeline.timeBudget + ' min',
    status: result.totalTime <= pipeline.timeBudget ? 'Within Budget' : 'Over Budget!',
    statusClass: result.totalTime <= pipeline.timeBudget ? 'status-ok' : 'status-error',
  });
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 3: TSP
// ═══════════════════════════════════════════════════════════════════

function showTSPInit() {
  const s3 = pipeline.stage3;
  // Highlight tour path
  if (s3.tour.length > 1) {
    for (const detail of s3.tourDetails) {
      scene.highlightPath(detail.roadPath, 0x00e5ff);
      scene.highlightStop(detail.to, 0x00ff88);
    }
  }
  scene.highlightStop(DEPOT_ID, 0xffab00);

  ui.renderTourTable(s3.tourDetails, s3.feasible, s3.totalDuration, pipeline.timeBudget);
  updateStatsForStage3();
}

function stepTSP(stepIdx) {
  const s3 = pipeline.stage3;
  const events = s3.tsp.events;
  const clampedIdx = ui.renderTSPStep(events, stepIdx);
  ui.stepIndex = clampedIdx;

  scene.resetAllHighlights();
  scene.highlightStop(DEPOT_ID, 0xffab00);

  // Show progressive updates
  for (let i = 0; i <= clampedIdx; i++) {
    const ev = events[i];
    if (ev.type === 'update') {
      scene.highlightStop(ev.fromId, 0x66aaff);
      scene.highlightStop(ev.toId, 0xff66aa);
    } else if (ev.type === 'prune') {
      scene.highlightStop(ev.toId, 0xaa4477);
    }
  }

  // On completion, show full tour
  const currentEvent = events[clampedIdx];
  if (currentEvent.type === 'done') {
    showTSPInit();

    // Start bus animation for the tour
    scene.clearBusAnimations();
    const fullRoadPath = [];
    for (const detail of s3.tourDetails) {
      if (fullRoadPath.length > 0) fullRoadPath.pop(); // Remove duplicate junction
      fullRoadPath.push(...detail.roadPath);
    }
    scene.setupBusAnimation(0, fullRoadPath, ui.animSpeed);
    busAnimActive = true;
  }

  updateStatsForStage3();
}

function updateStatsForStage3() {
  if (!pipeline.stage3) return;
  const s3 = pipeline.stage3;
  ui.updateStats({
    stops: (s3.tour.length - 2) + ' stops',
    demand: pipeline.stage2.selectedIds.reduce((s, id) => s + pipeline.stops[id].demand, 0),
    dist: s3.totalDist.toFixed(1) + ' km',
    duration: s3.totalDuration.toFixed(1) + ' / ' + pipeline.timeBudget + ' min',
    status: s3.feasible ? 'Feasible ✅' : 'Infeasible ⛔',
    statusClass: s3.feasible ? 'status-ok' : 'status-error',
  });
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 4: SCHEDULING
// ═══════════════════════════════════════════════════════════════════

function showSchedulingInit() {
  const s4 = pipeline.stage4;
  const BUS_HIGHLIGHT_COLORS = [0xff4444, 0x4488ff, 0x44dd66];

  // Color stops by bus assignment
  scene.resetAllHighlights();
  scene.highlightStop(DEPOT_ID, 0xffab00);

  for (const br of s4.busRoutes) {
    for (const id of br.stops) {
      if (id !== DEPOT_ID) {
        scene.highlightStop(id, BUS_HIGHLIGHT_COLORS[br.busId] || 0xffffff);
      }
    }
  }

  ui.renderBusTable(s4.busRoutes, s4.feasible, s4.infeasibleReason, s4.conflictList);
  updateStatsForStage4();
}

function stepScheduling(stepIdx) {
  const s4 = pipeline.stage4;
  const events = s4.events;
  const clampedIdx = ui.renderColoringStep(events, stepIdx);
  ui.stepIndex = clampedIdx;

  const BUS_HIGHLIGHT_COLORS = [0xff4444, 0x4488ff, 0x44dd66];

  scene.resetAllHighlights();
  scene.highlightStop(DEPOT_ID, 0xffab00);

  // Progressive coloring visualization
  for (let i = 0; i <= clampedIdx; i++) {
    const ev = events[i];
    if (ev.type === 'assign' && ev.assignments) {
      for (const [nodeStr, color] of Object.entries(ev.assignments)) {
        const nodeId = parseInt(nodeStr);
        scene.highlightStop(nodeId, BUS_HIGHLIGHT_COLORS[color] || 0xffffff);
      }
    }
  }

  const currentEvent = events[clampedIdx];
  if (currentEvent.type === 'done' || currentEvent.type === 'single_bus' || currentEvent.type === 'infeasible') {
    showSchedulingInit();

    // Animate all buses
    scene.clearBusAnimations();
    busAnimActive = false;

    if (s4.busRoutes && s4.busRoutes.length > 0) {
      for (const br of s4.busRoutes) {
        if (br.stops.length <= 2 && br.stops[0] === DEPOT_ID && br.stops[1] === DEPOT_ID) continue;

        const fullRoadPath = [];
        for (const detail of br.details) {
          if (fullRoadPath.length > 0) fullRoadPath.pop();
          fullRoadPath.push(...detail.roadPath);
        }
        if (fullRoadPath.length > 0) {
          scene.setupBusAnimation(br.busId, fullRoadPath, ui.animSpeed);
          busAnimActive = true;
        }

        // Highlight route edges
        for (const detail of br.details) {
          scene.highlightPath(detail.roadPath, BUS_HIGHLIGHT_COLORS[br.busId] || 0xffffff);
        }
      }
    }
  }

  updateStatsForStage4();
}

function updateStatsForStage4() {
  if (!pipeline.stage4) return;
  const s4 = pipeline.stage4;
  const totalDist = s4.busRoutes ? s4.busRoutes.reduce((s, br) => s + br.totalDist, 0) : 0;
  const maxTime = s4.busRoutes && s4.busRoutes.length > 0 ? Math.max(...s4.busRoutes.map(br => br.totalTime)) : 0;
  ui.updateStats({
    stops: pipeline.stage2.selectedIds.length + ' assigned',
    demand: s4.totalDemand,
    dist: totalDist.toFixed(1) + ' km (total)',
    duration: maxTime > 0 ? maxTime.toFixed(1) + ' min (longest bus)' : '—',
    status: s4.feasible ? 'All Feasible ✅' : (s4.infeasibleReason || 'Infeasible ⛔'),
    statusClass: s4.feasible ? 'status-ok' : 'status-error',
  });
}

// ── Start ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

