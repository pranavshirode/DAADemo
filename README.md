# PMPML Smart Route Planner — 3D Algorithm Visualizer

Interactive 3D visualization of bus route optimization algorithms for the Pune & Pimpri-Chinchwad transit network (PMPML).

> **⚠ Disclaimer:** All distances, travel times, demand values, and halt durations are **illustrative for educational purposes only**. They do not represent verified official PMPML data. The geographic layout is a simplified demonstration map.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run algorithm tests
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
├── index.html          # Main HTML with intro overlay & layout
├── style.css           # Complete responsive visual design
├── package.json        # Dependencies & scripts
├── vite.config.js      # Vite configuration
├── src/
│   ├── data.js         # Stops, roads, distances, demand, halt durations
│   ├── algorithms.js   # Dijkstra, Knapsack (greedy + DP), TSP (Held–Karp), Graph Coloring
│   ├── pipeline.js     # 4-stage pipeline coordinator
│   ├── scene.js        # Three.js 3D scene, stops, roads, buses, animations
│   ├── mapTexture.js   # 2D Google Maps-style light theme base map of Pune & PCMC
│   ├── ui.js           # Stage navigation, controls, tables, pseudocode, explanations
│   ├── main.js         # App initialization & event wiring
│   └── tests.js        # Unit tests for all algorithms
└── README.md
```

---

## 🎯 Four Algorithm Stages

### Stage 1 — Dijkstra's Shortest Path
Starting from **Nigdi Depot**, Dijkstra's algorithm finds the shortest path to every other stop in the network. Supports both **distance** (km) and **travel time** (minutes) weights.

- **Complexity:** O(V²) with simple array, O((V+E) log V) with priority queue
- **Watch:** Stops light up as visited, edges highlight during relaxation

### Stage 2 — Knapsack Stop Selection
Given a configurable time budget (30–180 minutes), select stops to maximize total passenger demand.

- **Greedy:** Sort by demand/time ratio, pick greedily — fast but not always optimal
- **0/1 DP:** Dynamic programming finds the truly optimal selection
- **Note:** Time cost per stop = shortest travel from depot + halt duration. This is a simplified heuristic — the actual tour cost is computed in Stage 3.

### Stage 3 — Travelling Salesman Problem
Optimize the visit order of selected stops using the **Held–Karp algorithm** (bitmask DP).

- **Complexity:** O(2ⁿ · n²) time, O(2ⁿ · n) space
- Uses actual road-network shortest-path costs (not straight-line distances)
- Validates feasibility against the time budget (travel + halt + return)

### Stage 4 — Multi-Bus Scheduling
Assign stops to 1–3 buses using **graph coloring with backtracking**.

- Builds a **conflict graph** from overlapping time windows
- Each bus gets its own TSP-optimized route
- Reports infeasibility if constraints cannot be satisfied

---

## 🎮 Controls

| Control | Function |
|---------|----------|
| **Stage tabs** | Switch between algorithm stages |
| **Next / Prev** | Step through algorithm events |
| **Auto Play / Pause** | Automatic step-through |
| **Speed slider** | Animation speed (0.1× to 3×) |
| **Time Budget** | Knapsack capacity (30–180 min) |
| **Buses selector** | 1, 2, or 3 buses |
| **Reset View** | Reset camera position |
| **Fullscreen** | Toggle fullscreen mode |
| **Mouse drag** | Orbit camera |
| **Scroll** | Zoom in/out |

---

## 📊 Demonstration Data

**10 stops:** Nigdi Depot, Bhosari, Pimpri, Wakad, Hinjewadi, Aundh, Shivajinagar, Pune Station, Swargate, Hadapsar

**14 road connections** with distances from 4 to 14 km.

Travel time = distance / average speed × 60 (configurable, default 25 km/h). Halt time is added separately per stop.

---

## 🌐 GitHub Pages Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. The `dist/` folder contains the production build. Deploy it to GitHub Pages using any method:

   **Option A — GitHub Actions:**
   Push `dist/` contents to the `gh-pages` branch.

   **Option B — Manual:**
   ```bash
   git subtree push --prefix dist origin gh-pages
   ```

   **Option C — Vite base path:**
   If deploying to `https://<user>.github.io/<repo>/`, update `vite.config.js`:
   ```js
   export default defineConfig({
     base: '/<repo>/',
   });
   ```

---

## 🛠 Technology

- **Three.js** — 3D rendering with WebGL
- **Vite** — Fast development server and build tool
- **OrbitControls** — Camera rotation and zoom
- **EffectComposer + UnrealBloomPass** — Glow post-processing
- **No backend, no API keys, no authentication** — runs entirely in the browser

---

## 📝 License

Educational project. Use freely for learning and presentations.

