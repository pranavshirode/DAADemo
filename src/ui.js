/**
 * ui.js — Stage navigation, controls, tables, pseudocode, explanations, statistics.
 */

import { STOPS, DEPOT_ID, ROADS } from './data.js';

const BUS_LABELS = ['Bus A (Red)', 'Bus B (Blue)', 'Bus C (Green)'];
const BUS_CSS_COLORS = ['#ff4444', '#4488ff', '#44dd66'];

// ── Pseudocode for each stage ─────────────────────────────────────

const PSEUDOCODE = {
  dijkstra: `function Dijkstra(G, source):
  for each vertex v in G:
    dist[v] ← ∞; prev[v] ← null
  dist[source] ← 0
  Q ← all vertices

  while Q is not empty:
    u ← vertex in Q with min dist[u]   ← CURRENT
    remove u from Q
    for each neighbor v of u:
      alt ← dist[u] + weight(u, v)     ← RELAX
      if alt < dist[v]:
        dist[v] ← alt
        prev[v] ← u

  return dist[], prev[]`,

  knapsack_greedy: `function GreedyKnapsack(items, capacity):
  sort items by (demand / timeCost) DESC
  selected ← []
  totalTime ← 0

  for each item in sorted:             ← EVALUATE
    if totalTime + item.time ≤ capacity:
      selected.add(item)                ← SELECT
      totalTime += item.time
    else:
      skip item                         ← REJECT

  return selected`,

  knapsack_dp: `function DPKnapsack(items, capacity):
  n ← items.length
  dp[0..n][0..capacity] ← 0

  for i = 1 to n:                       ← FILL ROW
    for c = 0 to capacity:
      if items[i].time ≤ c AND
         dp[i-1][c - time] + demand > dp[i-1][c]:
        dp[i][c] ← dp[i-1][c - time] + demand
      else:
        dp[i][c] ← dp[i-1][c]

  backtrack to find selected items      ← BACKTRACK
  return selected`,

  tsp: `function HeldKarp(nodes, dist, depot):
  dp[{depot}][depot] ← 0

  for each subset S containing depot:   ← EXPAND
    for each u in S:
      for each v not in S:
        newCost ← dp[S][u] + dist[u][v] ← UPDATE
        if newCost < dp[S∪{v}][v]:
          dp[S∪{v}][v] ← newCost

  find min dp[ALL][u] + dist[u][depot]  ← CLOSE TOUR
  backtrack for optimal tour
  return tour`,

  coloring: `function GraphColoring(nodes, conflicts, k):
  function backtrack(idx):
    if idx = n: return true (solution!)  ← FOUND

    for color = 0 to k-1:               ← TRY COLOR
      if isSafe(nodes[idx], color):
        assign color to nodes[idx]       ← ASSIGN
        if backtrack(idx + 1): return true
        unassign (backtrack)             ← BACKTRACK
      else:
        skip (conflict detected)         ← CONFLICT

    return false (infeasible)            ← FAIL`,
};

export class UI {
  constructor() {
    this.currentStage = 0; // 0 = intro
    this.stepIndex = 0;
    this.autoPlaying = false;
    this.autoPlayTimer = null;
    this.animSpeed = 1.0;
    this.onStageChange = null;
    this.onParameterChange = null;
    this.onStepChange = null;
    this.onAutoPlayToggle = null;
    this.onReset = null;
    this.pipeline = null;
  }

  setPipeline(pipeline) {
    this.pipeline = pipeline;
  }

  // ── Build the UI DOM ──────────────────────────────────────────

  buildUI() {
    // Intro overlay
    this._buildIntro();
    // Main panels
    this._buildStageTabs();
    this._buildControlBar();
    this._buildSidePanel();
    this._buildStatsBar();

    this.showIntro();
  }

  _buildIntro() {
    const intro = document.getElementById('intro-overlay');
    if (!intro) return;
    const btn = intro.querySelector('#start-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        intro.classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.switchStage(1);
      });
    }
  }

  _buildStageTabs() {
    const tabs = document.getElementById('stage-tabs');
    if (!tabs) return;

    const stages = [
      { id: 1, label: '1. Dijkstra', icon: '🔍' },
      { id: 2, label: '2. Knapsack', icon: '🎒' },
      { id: 3, label: '3. TSP', icon: '🗺️' },
      { id: 4, label: '4. Scheduling', icon: '🚌' },
    ];

    for (const s of stages) {
      const btn = document.createElement('button');
      btn.className = 'stage-tab';
      btn.dataset.stage = s.id;
      btn.innerHTML = `<span class="tab-icon">${s.icon}</span><span class="tab-label">${s.label}</span>`;
      btn.addEventListener('click', () => this.switchStage(s.id));
      tabs.appendChild(btn);
    }
  }

  _buildControlBar() {
    const bar = document.getElementById('control-bar');
    if (!bar) return;

    bar.innerHTML = `
      <div class="control-group">
        <button id="btn-prev" title="Previous Step">⏮ Prev</button>
        <button id="btn-next" title="Next Step">Next ⏭</button>
        <button id="btn-autoplay" title="Auto Play">▶ Auto Play</button>
        <button id="btn-reset" title="Reset">↺ Reset</button>
      </div>
      <div class="control-group">
        <label>Speed: <input type="range" id="speed-slider" min="0.1" max="3" step="0.1" value="1">
        <span id="speed-val">1.0×</span></label>
      </div>
      <div class="control-group" id="weight-group">
        <label>Weight:
          <select id="weight-select">
            <option value="dist" selected>Distance (km)</option>
            <option value="travelMin">Travel Time (min)</option>
          </select>
        </label>
      </div>
      <div class="control-group" id="knapsack-method-group">
        <label>Method:
          <select id="knapsack-select">
            <option value="dp" selected>0/1 Knapsack DP</option>
            <option value="greedy">Greedy (Demand/Time)</option>
          </select>
        </label>
      </div>
      <div class="control-group">
        <label>Time Budget:
          <input type="range" id="budget-slider" min="30" max="180" step="5" value="90">
          <span id="budget-val">90 min</span>
        </label>
      </div>
      <div class="control-group">
        <label>Buses:
          <select id="bus-select">
            <option value="1">1 Bus</option>
            <option value="2">2 Buses</option>
            <option value="3" selected>3 Buses</option>
          </select>
        </label>
      </div>
      <div class="control-group" id="buffer-group">
        <label>Safety Buffer:
          <input type="range" id="buffer-slider" min="1" max="15" step="1" value="5">
          <span id="buffer-val">5 min</span>
        </label>
      </div>
      <div class="control-group">
        <button id="btn-camera-reset" title="Reset Camera">📷 Reset View</button>
        <button id="btn-map-view" title="Toggle Top-Down Map View">🗺️ Map View</button>
        <button id="btn-fullscreen" title="Fullscreen">⛶ Fullscreen</button>
      </div>
    `;

    document.getElementById('btn-prev').addEventListener('click', () => this.prevStep());
    document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
    document.getElementById('btn-autoplay').addEventListener('click', () => this.toggleAutoPlay());
    document.getElementById('btn-reset').addEventListener('click', () => this.resetStage());

    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', () => {
      this.animSpeed = parseFloat(speedSlider.value);
      document.getElementById('speed-val').textContent = this.animSpeed.toFixed(1) + '×';
    });

    const weightSelect = document.getElementById('weight-select');
    weightSelect.addEventListener('change', () => {
      if (this.onParameterChange) this.onParameterChange('weightKey', weightSelect.value);
    });

    const knapsackSelect = document.getElementById('knapsack-select');
    knapsackSelect.addEventListener('change', () => {
      if (this.onParameterChange) this.onParameterChange('knapsackMethod', knapsackSelect.value);
    });

    const budgetSlider = document.getElementById('budget-slider');
    budgetSlider.addEventListener('input', () => {
      const val = parseInt(budgetSlider.value);
      document.getElementById('budget-val').textContent = val + ' min';
      if (this.onParameterChange) this.onParameterChange('timeBudget', val);
    });

    const busSelect = document.getElementById('bus-select');
    busSelect.addEventListener('change', () => {
      const val = parseInt(busSelect.value);
      if (this.onParameterChange) this.onParameterChange('numBuses', val);
    });

    const bufferSlider = document.getElementById('buffer-slider');
    bufferSlider.addEventListener('input', () => {
      const val = parseInt(bufferSlider.value);
      document.getElementById('buffer-val').textContent = val + ' min';
      if (this.onParameterChange) this.onParameterChange('safetyBuffer', val);
    });

    document.getElementById('btn-camera-reset').addEventListener('click', () => {
      if (this.onReset) this.onReset('camera');
    });

    document.getElementById('btn-map-view').addEventListener('click', () => {
      if (this.onReset) this.onReset('mapView');
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });
  }

  _buildSidePanel() {
    const panel = document.getElementById('side-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div id="explanation" class="panel-section">
        <h3>📖 Explanation</h3>
        <div id="explain-text" class="explain-content">Select a stage to begin.</div>
      </div>
      <div id="pseudocode-box" class="panel-section">
        <h3>📝 Pseudocode</h3>
        <pre id="pseudocode-content"></pre>
      </div>
      <div id="data-table-box" class="panel-section">
        <h3>📊 Data</h3>
        <div id="data-table-content"></div>
      </div>
      <div id="event-log-box" class="panel-section">
        <h3>📋 Event Log</h3>
        <div id="event-log" class="event-log"></div>
      </div>
    `;
  }

  _buildStatsBar() {
    const bar = document.getElementById('stats-bar');
    if (!bar) return;
    bar.innerHTML = `
      <div class="stat-item"><span class="stat-label">Stops Covered</span><span id="stat-stops" class="stat-value">—</span></div>
      <div class="stat-item"><span class="stat-label">Total Demand</span><span id="stat-demand" class="stat-value">—</span></div>
      <div class="stat-item"><span class="stat-label">Total Distance</span><span id="stat-dist" class="stat-value">—</span></div>
      <div class="stat-item"><span class="stat-label">Total Duration</span><span id="stat-duration" class="stat-value">—</span></div>
      <div class="stat-item"><span class="stat-label">Status</span><span id="stat-status" class="stat-value">—</span></div>
    `;
  }

  // ── Stage switching ─────────────────────────────────────────────

  switchStage(stageNum) {
    this.stopAutoPlay();
    this.currentStage = stageNum;
    this.stepIndex = 0;

    // Update tabs
    document.querySelectorAll('.stage-tab').forEach(t => {
      t.classList.toggle('active', parseInt(t.dataset.stage) === stageNum);
    });

    // Show/hide context controls per stage
    const weightGroup = document.getElementById('weight-group');
    const knapsackGroup = document.getElementById('knapsack-method-group');
    const budgetSlider = document.getElementById('budget-slider');
    const busSelect = document.getElementById('bus-select');
    const bufferGroup = document.getElementById('buffer-group');

    if (weightGroup) weightGroup.style.display = stageNum === 1 ? '' : 'none';
    if (knapsackGroup) knapsackGroup.style.display = stageNum === 2 ? '' : 'none';
    if (budgetSlider) budgetSlider.closest('.control-group').style.display = stageNum >= 2 ? '' : 'none';
    if (busSelect) busSelect.closest('.control-group').style.display = stageNum >= 4 ? '' : 'none';
    if (bufferGroup) bufferGroup.style.display = stageNum === 4 ? '' : 'none';

    if (this.onStageChange) this.onStageChange(stageNum);

    this._updateStageContent(stageNum);
  }

  _updateStageContent(stage) {
    const explain = document.getElementById('explain-text');
    const pseudo = document.getElementById('pseudocode-content');

    switch (stage) {
      case 1:
        explain.innerHTML = this._dijkstraExplanation();
        pseudo.textContent = PSEUDOCODE.dijkstra;
        break;
      case 2:
        explain.innerHTML = this._knapsackExplanation();
        pseudo.textContent = (this.pipeline && !this.pipeline.stage2?.useDpResult)
          ? PSEUDOCODE.knapsack_greedy
          : PSEUDOCODE.knapsack_dp;
        break;
      case 3:
        explain.innerHTML = this._tspExplanation();
        pseudo.textContent = PSEUDOCODE.tsp;
        break;
      case 4:
        explain.innerHTML = this._schedulingExplanation();
        pseudo.textContent = PSEUDOCODE.coloring;
        break;
    }
  }

  // ── Explanations ────────────────────────────────────────────────

  _dijkstraExplanation() {
    return `
      <p><strong>Stage 1: Dijkstra's Shortest Path Algorithm</strong></p>
      <p>Starting from <strong>Nigdi Depot</strong>, Dijkstra's algorithm explores the road network
      to find the shortest path to every other stop.</p>
      <p>At each step, it picks the unvisited stop with the smallest tentative distance,
      marks it visited, and <em>relaxes</em> all its edges — updating neighbor distances if a shorter
      path through the current node is found.</p>
      <p>Use <strong>Next</strong> to step through the algorithm. Watch the stops light up as they're
      visited and edges highlight when paths are updated.</p>
      <p class="note">⚙ Supports both distance (km) and travel-time (min) weights.</p>
    `;
  }

  _knapsackExplanation() {
    return `
      <p><strong>Stage 2: Knapsack Stop Selection</strong></p>
      <p>Given a time budget, which stops should a bus visit to maximise passenger demand?</p>
      <p>Each stop has a <em>demand</em> value and a <em>time cost</em> (travel from depot + halt).
      The <strong>Greedy</strong> approach sorts by demand/time ratio and picks greedily.
      The <strong>0/1 DP Knapsack</strong> finds the optimal selection.</p>
      <p>The DP table shows how the algorithm builds up solutions for increasing budgets.</p>
      <p class="note">⚠ This is a simplified heuristic. The time cost per stop is the shortest
      travel time from the depot plus halt time. The actual tour cost (Stage 3) may differ.</p>
    `;
  }

  _tspExplanation() {
    return `
      <p><strong>Stage 3: Travelling Salesman Problem</strong></p>
      <p>Once we've selected stops, we need the <em>best order</em> to visit them, minimizing
      total travel distance while starting and ending at the depot.</p>
      <p>The <strong>Held–Karp algorithm</strong> uses dynamic programming on subsets (bitmask DP)
      to find the optimal tour in O(2ⁿ · n²) time.</p>
      <p>Watch the algorithm explore subsets and build up partial tours. The final tour shows
      the optimal visit order with total distance, travel time, and halt time.</p>
      <p class="note">⚠ If the tour exceeds the time budget, infeasibility is reported.</p>
    `;
  }

  _schedulingExplanation() {
    return `
      <p><strong>Stage 4: Multi-Bus Scheduling</strong></p>
      <p>Assign stops to multiple buses so no two buses need the same stop at overlapping times.</p>
      <p>We build a <strong>conflict graph</strong> where stops with overlapping time windows are
      connected, then use <strong>graph coloring with backtracking</strong> to assign bus colors.</p>
      <p>Each bus then gets its own TSP-optimized route, starting and ending at the depot.</p>
      <p class="note">⚠ Graph coloring demonstrates conflict resolution. The actual scheduling
      also accounts for travel times between stops.</p>
    `;
  }

  // ── Step-by-step navigation ─────────────────────────────────────

  nextStep() {
    this.stepIndex++;
    if (this.onStepChange) this.onStepChange(this.currentStage, this.stepIndex);
  }

  prevStep() {
    if (this.stepIndex > 0) {
      this.stepIndex--;
      if (this.onStepChange) this.onStepChange(this.currentStage, this.stepIndex);
    }
  }

  toggleAutoPlay() {
    if (this.autoPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  startAutoPlay() {
    this.autoPlaying = true;
    const btn = document.getElementById('btn-autoplay');
    if (btn) btn.textContent = '⏸ Pause';

    const tick = () => {
      if (!this.autoPlaying) return;
      this.nextStep();
      this.autoPlayTimer = setTimeout(tick, 800 / this.animSpeed);
    };
    tick();
  }

  stopAutoPlay() {
    this.autoPlaying = false;
    const btn = document.getElementById('btn-autoplay');
    if (btn) btn.textContent = '▶ Auto Play';
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  resetStage() {
    this.stopAutoPlay();
    this.stepIndex = 0;
    if (this.onReset) this.onReset('stage');
  }

  showIntro() {
    document.getElementById('intro-overlay').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
  }

  // ── Rendering algorithm events ──────────────────────────────────

  renderDijkstraStep(events, stepIdx) {
    if (stepIdx >= events.length) {
      this.stopAutoPlay();
      return events.length - 1;
    }
    const clampedIdx = Math.min(stepIdx, events.length - 1);
    const event = events[clampedIdx];

    // Update event log
    this._appendEventLog(this._formatDijkstraEvent(event), clampedIdx);

    // Update distance table
    if (event.distances || event.type === 'done') {
      const dists = event.distances || [];
      this._renderDistanceTable(dists, event.type === 'done' ? events[events.length - 1].prev : null);
    }

    // Highlight pseudocode line
    this._highlightPseudoLine(event.type === 'visit' ? 6 : event.type === 'relax' ? 9 : -1);

    return clampedIdx;
  }

  _formatDijkstraEvent(ev) {
    const isTime = this.pipeline && this.pipeline.weightKey === 'travelMin';
    const unit = isTime ? ' min' : ' km';
    switch (ev.type) {
      case 'init': return `🟢 Initialize: source = ${STOPS[ev.source].name}`;
      case 'visit': return `📍 Visit <strong>${STOPS[ev.node].name}</strong> (${isTime ? 'time' : 'dist'}=${ev.dist.toFixed(1)}${unit})`;
      case 'relax': return `✏️ Relax ${STOPS[ev.from].name} → ${STOPS[ev.to].name}: ${ev.oldDist === Infinity ? '∞' : ev.oldDist.toFixed(1) + unit} → ${ev.newDist.toFixed(1)}${unit}`;
      case 'skip': return `⏭ Skip ${STOPS[ev.from].name} → ${STOPS[ev.to].name}: candidate ${ev.candidate.toFixed(1)}${unit} ≥ current ${ev.currentDist.toFixed(1)}${unit}`;
      case 'done': return `✅ Dijkstra complete! Shortest paths determined.`;
      default: return `Step: ${ev.type}`;
    }
  }

  renderKnapsackStep(greedyEvents, dpEvents, stepIdx, useDP) {
    const events = useDP ? dpEvents : greedyEvents;
    if (stepIdx >= events.length) {
      this.stopAutoPlay();
      return events.length - 1;
    }
    const idx = Math.min(stepIdx, events.length - 1);
    const event = events[idx];

    this._appendEventLog(this._formatKnapsackEvent(event, useDP), idx);
    this._highlightPseudoLine(
      event.type === 'select' ? 5 :
      event.type === 'reject' ? 7 :
      event.type === 'row' ? 4 :
      event.type === 'backtrack_select' ? 8 : -1
    );

    return idx;
  }

  _formatKnapsackEvent(ev, useDP) {
    switch (ev.type) {
      case 'init':
        return useDP ? `🟢 DP Knapsack: ${ev.numItems} items, capacity = ${ev.capacity} min`
                     : `🟢 Greedy: sorted by demand/time ratio`;
      case 'select': return `✅ SELECT ${STOPS[ev.id].name} — demand=${ev.demand}, time=${ev.timeCost.toFixed(1)}min, budget remaining=${ev.remaining.toFixed(1)}min`;
      case 'reject': return `❌ REJECT ${STOPS[ev.id].name} — ${ev.reason}`;
      case 'row': return `📊 DP row ${ev.itemIdx}: ${STOPS[ev.id].name} — max demand at full capacity = ${ev.maxAtCapacity}`;
      case 'backtrack_select': return `🔙 Backtrack: include ${STOPS[ev.id].name}`;
      case 'done': return `✅ Done! Selected ${ev.selected.length} stops, demand=${ev.totalDemand}, time=${ev.totalTime.toFixed(1)}min`;
      default: return `${ev.type}`;
    }
  }

  renderTSPStep(events, stepIdx) {
    if (stepIdx >= events.length) {
      this.stopAutoPlay();
      return events.length - 1;
    }
    const idx = Math.min(stepIdx, events.length - 1);
    const event = events[idx];

    this._appendEventLog(this._formatTSPEvent(event), idx);
    this._highlightPseudoLine(
      event.type === 'update' ? 5 :
      event.type === 'prune' ? 6 :
      event.type === 'done' ? 7 : -1
    );

    return idx;
  }

  _formatTSPEvent(ev) {
    switch (ev.type) {
      case 'init': return `🟢 TSP Held–Karp: ${ev.nodes.length} nodes, depot = ${STOPS[ev.depot].name}`;
      case 'update': return `🔄 Improved: ${STOPS[ev.fromId].name} → ${STOPS[ev.toId].name}, cost=${ev.cost.toFixed(1)} km`;
      case 'prune': return `✂️ Pruned: ${STOPS[ev.fromId].name} → ${STOPS[ev.toId].name} (candidate ${ev.candidateCost.toFixed(1)}km ≥ best ${ev.currentBest.toFixed(1)}km)`;
      case 'infeasible': return `⛔ ${ev.reason}`;
      case 'done': return `✅ Optimal tour found! Distance = ${ev.totalDist.toFixed(1)} km<br>Tour: ${ev.tour.map(id => STOPS[id].name).join(' → ')}`;
      default: return `${ev.type}`;
    }
  }

  renderColoringStep(events, stepIdx) {
    if (stepIdx >= events.length) {
      this.stopAutoPlay();
      return events.length - 1;
    }
    const idx = Math.min(stepIdx, events.length - 1);
    const event = events[idx];

    this._appendEventLog(this._formatColoringEvent(event), idx);
    this._highlightPseudoLine(
      event.type === 'try' ? 4 :
      event.type === 'assign' ? 5 :
      event.type === 'backtrack' ? 6 :
      event.type === 'conflict' ? 7 : -1
    );

    return idx;
  }

  _formatColoringEvent(ev) {
    switch (ev.type) {
      case 'init': return `🟢 Graph Coloring: ${ev.nodes.length} nodes, ${ev.numColors} colors (buses)`;
      case 'try': return `🎨 Try ${BUS_LABELS[ev.color] || `Color ${ev.color}`} for ${STOPS[ev.node]?.name || ev.node}`;
      case 'assign': return `✅ Assign ${STOPS[ev.node]?.name || ev.node} → ${BUS_LABELS[ev.color] || `Color ${ev.color}`}`;
      case 'conflict': return `⚠️ Conflict: ${STOPS[ev.node]?.name || ev.node} conflicts with ${ev.conflictsWith.map(id => STOPS[id]?.name || id).join(', ')}`;
      case 'backtrack': return `↩️ Backtrack: unassign ${STOPS[ev.node]?.name || ev.node}`;
      case 'fail': return `❌ No valid color for ${STOPS[ev.node]?.name || ev.node} at position ${ev.idx}`;
      case 'solution': return `🎉 Solution found!`;
      case 'infeasible': return `⛔ ${ev.reason}`;
      case 'done': return `✅ Coloring complete!`;
      case 'single_bus': return `🚌 Single bus mode — using TSP tour directly.`;
      default: return `${ev.type}`;
    }
  }

  // ── Data tables ─────────────────────────────────────────────────

  _renderDistanceTable(dists, prev) {
    const container = document.getElementById('data-table-content');
    if (!container) return;

    const isTime = this.pipeline && this.pipeline.weightKey === 'travelMin';
    const unit = isTime ? 'min' : 'km';
    const header = isTime ? 'Travel Time' : 'Distance';

    let html = `<table class="data-table"><thead><tr><th>Stop</th><th>${header}</th><th>Via</th></tr></thead><tbody>`;
    for (let i = 0; i < STOPS.length; i++) {
      const d = dists[i];
      const via = prev && prev[i] >= 0 ? STOPS[prev[i]].name : (i === DEPOT_ID ? '—' : '?');
      const valStr = d === Infinity ? '∞' : `${d.toFixed(1)} ${unit}`;
      html += `<tr class="${i === DEPOT_ID ? 'depot-row' : ''}">
        <td>${STOPS[i].name}</td>
        <td>${valStr}</td>
        <td>${via}</td>
      </tr>`;
    }
    html += '</tbody></table>';

    if (prev) {
      html += `<div style="margin-top:12px; font-size:0.78rem;">
        <strong style="color:var(--cyan);">Shortest Paths from Nigdi Depot:</strong>
        <div style="margin-top:6px; max-height:140px; overflow-y:auto; line-height:1.6; padding-right:4px;">`;
      for (let i = 1; i < STOPS.length; i++) {
        if (dists[i] < Infinity) {
          const path = [];
          let cur = i;
          while (cur !== -1) { path.unshift(STOPS[cur].name); cur = prev[cur]; }
          html += `<div style="padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.04);">• <b>${STOPS[i].name}</b> (${dists[i].toFixed(1)} ${unit}): <span style="color:var(--text-secondary);">${path.join(' → ')}</span></div>`;
        }
      }
      html += `</div></div>`;
    }

    container.innerHTML = html;
  }

  renderKnapsackTable(items, selectedIds, greedyResult = null, dpResult = null) {
    const container = document.getElementById('data-table-content');
    if (!container) return;

    let html = '';
    if (greedyResult && dpResult) {
      html += `
        <div style="display:flex; gap:8px; margin-bottom:10px;">
          <div style="flex:1; padding:8px; background:rgba(0,229,255,0.06); border:1px solid rgba(0,229,255,0.2); border-radius:6px; font-size:0.78rem;">
            <strong>Greedy Selection</strong><br>
            Demand: <b>${greedyResult.totalDemand}</b><br>
            Time: <b>${greedyResult.totalTime.toFixed(1)}m</b> (${greedyResult.selected.length} stops)
          </div>
          <div style="flex:1; padding:8px; background:rgba(68,221,102,0.08); border:1px solid rgba(68,221,102,0.3); border-radius:6px; font-size:0.78rem;">
            <strong>0/1 DP (Optimal)</strong><br>
            Demand: <b>${dpResult.totalDemand}</b><br>
            Time: <b>${dpResult.totalTime.toFixed(1)}m</b> (${dpResult.selected.length} stops)
          </div>
        </div>
      `;
    }

    html += '<table class="data-table"><thead><tr><th>Stop</th><th>Demand</th><th>Time Cost</th><th>Ratio</th><th>Selected</th></tr></thead><tbody>';
    for (const item of items) {
      const sel = selectedIds.includes(item.id);
      const ratio = item.timeCost > 0 ? (item.demand / item.timeCost).toFixed(1) : '—';
      html += `<tr class="${sel ? 'selected-row' : 'rejected-row'}">
        <td>${STOPS[item.id].name}</td>
        <td>${item.demand}</td>
        <td>${item.timeCost.toFixed(1)} min</td>
        <td>${ratio}</td>
        <td>${sel ? '✅' : '❌'}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  renderTourTable(tourDetails, feasible, totalDuration = 0, budget = 90) {
    const container = document.getElementById('data-table-content');
    if (!container) return;

    let html = `<div class="feasibility ${feasible ? 'feasible' : 'infeasible'}">
      ${feasible ? '✅ Tour fits within time budget' : `⛔ Tour exceeds budget (${totalDuration.toFixed(1)}m > ${budget}m)!`}
      ${!feasible ? '<br><button id="btn-auto-prune" style="margin-top:6px; padding:4px 10px; background:var(--red); color:#fff; border:none; border-radius:4px; font-size:0.75rem; cursor:pointer;">✂️ Auto-Prune to Fit Budget</button>' : ''}
    </div>`;
    html += '<table class="data-table"><thead><tr><th>From</th><th>To</th><th>Dist</th><th>Travel</th><th>Halt</th></tr></thead><tbody>';
    for (const d of tourDetails) {
      html += `<tr>
        <td>${STOPS[d.from].name}</td>
        <td>${STOPS[d.to].name}</td>
        <td>${d.dist.toFixed(1)} km</td>
        <td>${d.travelTime.toFixed(1)} min</td>
        <td>${d.halt} min</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;

    const pruneBtn = document.getElementById('btn-auto-prune');
    if (pruneBtn) {
      pruneBtn.addEventListener('click', () => {
        if (this.onAction) this.onAction('autoPrune');
      });
    }
  }

  renderBusTable(busRoutes, feasible, infeasibleReason = '', conflictList = []) {
    const container = document.getElementById('data-table-content');
    if (!container) return;

    let html = `<div class="feasibility ${feasible ? 'feasible' : 'infeasible'}">
      ${feasible ? '✅ All buses within budget & conflict-free' : `⛔ ${infeasibleReason || 'Schedule constraint violation!'}`}
    </div>`;

    if (conflictList && conflictList.length > 0) {
      html += `<div style="margin-bottom:10px; padding:8px; background:rgba(255,68,68,0.08); border:1px solid rgba(255,68,68,0.25); border-radius:6px; font-size:0.75rem;">
        <strong style="color:var(--red);">Time Window Conflicts (${conflictList.length}):</strong>
        <div style="margin:4px 0 6px 0; max-height:80px; overflow-y:auto; line-height:1.5; color:var(--text-secondary);">
          ${conflictList.map(c => `<div>• ${c}</div>`).join('')}
        </div>
        <div style="color:var(--amber);">💡 Tip: Increase bus count to 3, or lower safety buffer.</div>
      </div>`;
    }

    if (!busRoutes || busRoutes.length === 0) {
      html += `<div style="padding:10px; text-align:center; color:var(--text-dim); font-size:0.8rem;">No valid route assignments possible due to conflicts.</div>`;
    } else {
      for (const br of busRoutes) {
        if (br.stops.length <= 2 && br.stops[0] === DEPOT_ID && br.stops[1] === DEPOT_ID) {
          html += `<div class="bus-card" style="border-left: 3px solid ${BUS_CSS_COLORS[br.busId]}; opacity: 0.6;">
            <h4 style="color:${BUS_CSS_COLORS[br.busId]}">${BUS_LABELS[br.busId]} (Idle)</h4>
            <p>Idle at Nigdi Depot (0 stops assigned).</p>
          </div>`;
          continue;
        }
        html += `<div class="bus-card" style="border-left: 3px solid ${BUS_CSS_COLORS[br.busId]}">
          <h4 style="color:${BUS_CSS_COLORS[br.busId]}">${BUS_LABELS[br.busId]}</h4>
          <p>Route: ${br.stops.map(id => STOPS[id].name).join(' → ')}</p>
          <p>Dist: ${br.totalDist.toFixed(1)} km | Time: ${br.totalTime.toFixed(1)} min | Demand: ${br.demand}</p>
        </div>`;
      }
    }
    container.innerHTML = html;
  }

  // ── Statistics bar ──────────────────────────────────────────────

  updateStats(data) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-stops', data.stops ?? '—');
    set('stat-demand', data.demand ?? '—');
    set('stat-dist', data.dist ?? '—');
    set('stat-duration', data.duration ?? '—');

    const statusEl = document.getElementById('stat-status');
    if (statusEl) {
      statusEl.textContent = data.status ?? '—';
      statusEl.className = 'stat-value ' + (data.statusClass || '');
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _appendEventLog(html, stepIdx) {
    const log = document.getElementById('event-log');
    if (!log) return;

    // Only keep last 50 entries
    while (log.children.length > 50) log.removeChild(log.firstChild);

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-step">#${stepIdx}</span> ${html}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  clearEventLog() {
    const log = document.getElementById('event-log');
    if (log) log.innerHTML = '';
  }

  _highlightPseudoLine(lineIdx) {
    const pre = document.getElementById('pseudocode-content');
    if (!pre) return;

    const lines = pre.textContent.split('\n');
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      const cls = (i === lineIdx) ? 'pseudo-highlight' : '';
      html += `<span class="${cls}">${this._escapeHtml(lines[i])}</span>\n`;
    }
    pre.innerHTML = html;
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

