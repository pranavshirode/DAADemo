/**
 * scene.js — Three.js 3D scene: city map, stops, roads, buses, labels, lights, animations.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { STOPS, ROADS, DEPOT_ID } from './data.js';
import { createPuneMapTexture } from './mapTexture.js';

const BUS_COLORS = [0xef4444, 0x1d4ed8, 0x16a34a]; // Vibrant Red, Blue, Green
const STOP_COLOR = 0x0284c7; // 3D Cyan/Blue Transit Pillar
const DEPOT_COLOR = 0xd97706; // 3D Amber/Gold Depot Pillar
const ROAD_COLOR = 0x475569; // Clean Charcoal/Slate Route Line
const ROAD_HIGHLIGHT = 0x0284c7; // Highlighted Route Color

export class Scene3D {
  constructor(container) {
    this.container = container;
    this.stopMeshes = [];
    this.roadLines = [];
    this.roadLabels = [];
    this.busMeshes = [];
    this.labelSprites = [];
    this.trailLines = [];
    this.highlightedEdges = new Set();
    this.animatingBuses = [];
    this.mapTexture = null;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initControls();
    this._initLights();
    this._initPostProcessing();
    this._buildGround();
    this._buildStops();
    this._buildRoads();
    this._buildBuses();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  // ── Initialization ──────────────────────────────────────────────

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf1f3f4, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xf1f3f4, 0.0006);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 115, 45);
    this.camera.lookAt(0, 0, 10);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 10);
    this.controls.minDistance = 20;
    this.controls.maxDistance = 250;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.update();
  }

  _initLights() {
    // Bright white ambient light for clean Google Maps illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.88);
    this.scene.add(ambient);

    // Directional sunlight casting crisp shadows from 3D bus stops onto 2D map
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(35, 90, 45);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 300;
    dir.shadow.camera.left = -90;
    dir.shadow.camera.right = 90;
    dir.shadow.camera.top = 90;
    dir.shadow.camera.bottom = -90;
    this.scene.add(dir);

    // Soft fill light
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-30, 60, -30);
    this.scene.add(fill);
  }

  _initPostProcessing() {
    try {
      this.composer = new EffectComposer(this.renderer);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.4,  // strength
        0.3,  // radius
        0.95  // threshold (high threshold keeps white map clean & sharp)
      );
      this.composer.addPass(this.bloomPass);
      this.useComposer = true;
    } catch (e) {
      console.warn('Post-processing unavailable:', e);
      this.useComposer = false;
    }
  }

  // ── Ground: 2D White Google Map Base ──────────────────────────
  _buildGround() {
    const MAP_SIZE = 260;

    // 1. High-Resolution 2D Google Maps-Style Canvas Texture on Flat Base Plane
    this.mapTexture = createPuneMapTexture(2048, MAP_SIZE);
    const mapGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 1, 1);
    const mapMat = new THREE.MeshStandardMaterial({
      map: this.mapTexture,
      roughness: 0.85,
      metalness: 0.05,
    });
    const mapPlane = new THREE.Mesh(mapGeo, mapMat);
    mapPlane.rotation.x = -Math.PI / 2;
    mapPlane.position.y = 0;
    mapPlane.receiveShadow = true;
    this.scene.add(mapPlane);

    // 2. Seamless Outer Extension Floor (Google Maps Grey #f1f3f4)
    const outerGeo = new THREE.PlaneGeometry(900, 900);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xf1f3f4,
    });
    const outerPlane = new THREE.Mesh(outerGeo, outerMat);
    outerPlane.rotation.x = -Math.PI / 2;
    outerPlane.position.y = -0.05;
    this.scene.add(outerPlane);
  }

  // ── 3D Bus Stops (The only 3D elements standing on the 2D map) ───

  _buildStops() {
    for (const stop of STOPS) {
      const isDepot = stop.id === DEPOT_ID;
      // Proportional 3D pillar height based on passenger demand
      const height = isDepot ? 8.0 : 4.0 + (stop.demand / 35);
      const radius = isDepot ? 2.0 : 1.25;
      const color = isDepot ? DEPOT_COLOR : STOP_COLOR;

      // 3D Pillar standing tall on the flat 2D Google Map
      const geo = new THREE.CylinderGeometry(radius * 0.75, radius, height, isDepot ? 8 : 16);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(stop.x, height / 2, stop.z);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.userData = { stopId: stop.id };
      this.scene.add(mesh);
      this.stopMeshes.push(mesh);

      // Depot top beacon disc
      if (isDepot) {
        const beaconGeo = new THREE.CylinderGeometry(2.6, 2.6, 0.4, 16);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xffcc00,
          emissive: 0xffaa00,
          emissiveIntensity: 0.6,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(stop.x, height + 0.2, stop.z);
        this.scene.add(beacon);
      }

      // Base ring on 2D map surface
      const ringGeo = new THREE.RingGeometry(radius + 0.3, radius + 1.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(stop.x, 0.05, stop.z);
      this.scene.add(ring);

      // Large Prominent Floating Stop Name Badge
      const subText = isDepot ? 'PMPML Central Depot • Hub' : `👥 ${stop.demand} passengers • ⏱ ${stop.halt}m halt`;
      const badge = this._createStopBadge(stop.name, subText, isDepot);
      badge.position.set(stop.x, height + 5.5, stop.z);
      this.scene.add(badge);
      this.labelSprites.push(badge);
    }
  }

  _createStopBadge(name, subText, isDepot = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');

    const w = 1024;
    const h = 340;
    const pad = 16;
    const cardW = w - pad * 2;
    const cardH = h - pad * 2 - 42;
    const r = 36;
    const x = pad;
    const y = pad;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    // Card background: Solid high-contrast deep dark slate
    ctx.fillStyle = isDepot ? '#1a1402' : '#0b1329';
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, r);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Glowing accent border
    ctx.strokeStyle = isDepot ? '#ffab00' : '#00e5ff';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Downward pointer arrow (pointing towards 3D pillar)
    ctx.fillStyle = isDepot ? '#ffab00' : '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 32, y + cardH - 2);
    ctx.lineTo(w / 2 + 32, y + cardH - 2);
    ctx.lineTo(w / 2, y + cardH + 36);
    ctx.closePath();
    ctx.fill();

    // Top Header line: Icon & Type
    const icon = isDepot ? '🚌 BASE DEPOT' : '🚏 BUS STOP';
    ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isDepot ? '#ffab00' : '#00e5ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(icon, x + 44, y + 36);

    // Stop Name — HUGE, BOLD & VIBRANT
    ctx.font = '900 66px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(name, x + 44, y + 84);

    // Subtitle line (Demand & Halt duration)
    ctx.font = '600 40px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isDepot ? '#ffcc80' : '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(subText, x + 44, y + 170);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    const spriteW = isDepot ? 26 : 22;
    const spriteH = spriteW * (340 / 1024);
    sprite.scale.set(spriteW, spriteH, 1);
    return sprite;
  }

  // ── Roads: 2D Transit Connections on the Map ─────────────────────

  _buildRoads() {
    for (const [a, b, dist] of ROADS) {
      const sa = STOPS[a];
      const sb = STOPS[b];

      // Flat 2D road line on the map surface (y = 0.08)
      const points = [
        new THREE.Vector3(sa.x, 0.08, sa.z),
        new THREE.Vector3(sb.x, 0.08, sb.z),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: ROAD_COLOR,
        transparent: true,
        opacity: 0.8,
        linewidth: 2,
      });
      const line = new THREE.Line(geo, mat);
      line.userData = { from: a, to: b };
      this.scene.add(line);
      this.roadLines.push(line);

      // Flat 2D road ribbon for rich route styling (y = 0.05)
      const dir = new THREE.Vector3(sb.x - sa.x, 0, sb.z - sa.z);
      const len = dir.length();
      const midPos = new THREE.Vector3((sa.x + sb.x) / 2, 0.05, (sa.z + sb.z) / 2);
      const bedGeo = new THREE.BoxGeometry(1.6, 0.04, len);
      const bedMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.7,
        metalness: 0.2,
      });
      const bed = new THREE.Mesh(bedGeo, bedMat);
      bed.position.copy(midPos);
      bed.lookAt(sb.x, 0.05, sb.z);
      bed.userData = { from: a, to: b };
      this.scene.add(bed);

      // Distance & travel-time label on road
      const mid = new THREE.Vector3(
        (sa.x + sb.x) / 2,
        1.2,
        (sa.z + sb.z) / 2
      );
      const travelMin = Math.round((dist / 25) * 60);
      const roadLabel = this._createRoadLabel(`${dist}km • ${travelMin}m`);
      roadLabel.position.copy(mid);
      this.scene.add(roadLabel);
      this.roadLabels.push(roadLabel);
    }
  }

  _createRoadLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');

    // Rounded badge
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 120, 24);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 44px Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 70);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(9, 2.45, 1);
    return sprite;
  }

  // ── Buses ───────────────────────────────────────────────────────

  _buildBuses() {
    for (let i = 0; i < 3; i++) {
      const bus = this._createBusModel(BUS_COLORS[i]);
      bus.position.set(STOPS[DEPOT_ID].x + (i - 1) * 3, 1.2, STOPS[DEPOT_ID].z - 3);
      bus.visible = false;
      bus.userData = { busId: i };
      this.scene.add(bus);
      this.busMeshes.push(bus);
    }
  }

  _createBusModel(color) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2.2, 1.2, 3.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    // Roof
    const roofGeo = new THREE.BoxGeometry(2.0, 0.3, 2.8);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 1.35;
    group.add(roof);

    // Windows
    const winGeo = new THREE.BoxGeometry(2.3, 0.5, 2.6);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.4,
      emissive: 0x88ccff,
      emissiveIntensity: 0.2,
    });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.y = 0.9;
    group.add(win);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const positions = [
      [-1.1, 0.1, -1.0],
      [-1.1, 0.1, 1.0],
      [1.1, 0.1, -1.0],
      [1.1, 0.1, 1.0],
    ];
    for (const [wx, wy, wz] of positions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }

    // Headlights
    const lightGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
    for (const lx of [-0.6, 0.6]) {
      const headlight = new THREE.Mesh(lightGeo, lightMat);
      headlight.position.set(lx, 0.5, -1.8);
      group.add(headlight);
    }

    return group;
  }

  // ── Highlighting ────────────────────────────────────────────────

  highlightStop(stopId, color = 0x00ff88) {
    const mesh = this.stopMeshes[stopId];
    if (mesh) {
      mesh.material.emissive.setHex(color);
      mesh.material.emissiveIntensity = 0.8;
    }
  }

  resetStopHighlight(stopId) {
    const mesh = this.stopMeshes[stopId];
    if (mesh) {
      const isDepot = stopId === DEPOT_ID;
      mesh.material.emissive.setHex(isDepot ? DEPOT_COLOR : STOP_COLOR);
      mesh.material.emissiveIntensity = 0.3;
    }
  }

  resetAllHighlights() {
    for (let i = 0; i < STOPS.length; i++) {
      this.resetStopHighlight(i);
    }
    for (const line of this.roadLines) {
      line.material.color.setHex(ROAD_COLOR);
      line.material.opacity = 0.6;
    }
    this.highlightedEdges.clear();
  }

  highlightEdge(from, to, color = ROAD_HIGHLIGHT) {
    const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
    for (const line of this.roadLines) {
      const lk = `${Math.min(line.userData.from, line.userData.to)}-${Math.max(line.userData.from, line.userData.to)}`;
      if (lk === key) {
        line.material.color.setHex(color);
        line.material.opacity = 1.0;
        this.highlightedEdges.add(key);
      }
    }
  }

  highlightPath(path, color = ROAD_HIGHLIGHT) {
    for (let i = 0; i < path.length - 1; i++) {
      this.highlightEdge(path[i], path[i + 1], color);
    }
  }

  // ── Bus animation ───────────────────────────────────────────────

  /**
   * Set up bus animation along a route.
   * route: array of stop IDs forming the path (following road connections)
   * busId: 0, 1, or 2
   * roadPaths: array of detailed road-level paths between consecutive tour stops
   */
  setupBusAnimation(busId, roadPath, speed = 1) {
    const bus = this.busMeshes[busId];
    if (!bus) return;
    bus.visible = true;

    // Build waypoints from the road path
    const waypoints = [];
    for (const stopId of roadPath) {
      const s = STOPS[stopId];
      waypoints.push(new THREE.Vector3(s.x, 1.2, s.z));
    }

    // Create trail line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({
      color: BUS_COLORS[busId],
      transparent: true,
      opacity: 0.6,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trail);
    this.trailLines.push(trail);

    this.animatingBuses[busId] = {
      busId,
      bus,
      waypoints,
      currentIdx: 0,
      t: 0,
      speed,
      done: false,
      trail,
      trailPoints: [waypoints[0].clone()],
      haltTimer: 0,
      haltDuration: 0,
    };

    // Set initial position
    if (waypoints.length > 0) {
      bus.position.copy(waypoints[0]);
    }
  }

  clearBusAnimations() {
    for (let i = 0; i < this.busMeshes.length; i++) {
      const bus = this.busMeshes[i];
      bus.visible = false;
      const depot = STOPS[DEPOT_ID];
      bus.position.set(depot.x + (i - 1) * 3, 1.2, depot.z - 3);
    }
    for (const trail of this.trailLines) {
      this.scene.remove(trail);
      trail.geometry.dispose();
      trail.material.dispose();
    }
    this.trailLines = [];
    this.animatingBuses = [];
  }

  /**
   * Update bus animations. Call each frame.
   * @param {number} delta — seconds since last frame
   * @returns {boolean} true if any bus is still animating
   */
  updateBusAnimations(delta) {
    let anyActive = false;
    for (const anim of this.animatingBuses) {
      if (!anim || anim.done) continue;

      // Handle halt at stop
      if (anim.haltTimer > 0) {
        anim.haltTimer -= delta;
        anyActive = true;
        continue;
      }

      const wp = anim.waypoints;
      if (anim.currentIdx >= wp.length - 1) {
        anim.done = true;
        continue;
      }

      const from = wp[anim.currentIdx];
      const to = wp[anim.currentIdx + 1];
      const segDist = from.distanceTo(to);
      const moveSpeed = 15 * anim.speed; // units per second

      anim.t += (delta * moveSpeed) / Math.max(segDist, 0.01);

      if (anim.t >= 1) {
        anim.t = 0;
        anim.currentIdx++;
        anim.bus.position.copy(to);
        anim.trailPoints.push(to.clone());

        // Update trail
        const trailGeo = new THREE.BufferGeometry().setFromPoints(anim.trailPoints);
        anim.trail.geometry.dispose();
        anim.trail.geometry = trailGeo;

        // Check if this waypoint is a halt stop
        const stopId = this._findStopAt(to);
        if (stopId >= 0 && stopId !== DEPOT_ID) {
          const halt = STOPS[stopId].halt || 0;
          anim.haltTimer = halt * 0.15 / Math.max(anim.speed, 0.1); // Scaled halt
        }

        anyActive = anim.currentIdx < wp.length - 1;
      } else {
        const pos = new THREE.Vector3().lerpVectors(from, to, anim.t);
        const dir = new THREE.Vector3().subVectors(to, from).normalize();
        if (dir.lengthSq() > 0) {
          // Lane lateral offset so multiple buses do not intersect
          const laneOffset = (anim.busId - 1) * 0.8;
          const lateral = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(laneOffset);
          pos.add(lateral);
          anim.bus.position.copy(pos);
          anim.bus.lookAt(anim.bus.position.clone().add(dir));
        } else {
          anim.bus.position.copy(pos);
        }
        anyActive = true;
      }
    }
    return anyActive;
  }

  _findStopAt(pos) {
    for (const s of STOPS) {
      if (Math.abs(s.x - pos.x) < 0.5 && Math.abs(s.z - pos.z) < 0.5) return s.id;
    }
    return -1;
  }

  // ── Camera ──────────────────────────────────────────────────────

  resetCamera() {
    this._isMapView = false;
    this.camera.position.set(0, 115, 45);
    this.controls.target.set(0, 0, 10);
    this.controls.update();
  }

  toggleMapView() {
    this._isMapView = !this._isMapView;
    if (this._isMapView) {
      this.camera.position.set(0, 150, 0.01);
      this.controls.target.set(0, 0, 0);
    } else {
      this.camera.position.set(0, 115, 45);
      this.controls.target.set(0, 0, 10);
    }
    this.controls.update();
    return this._isMapView;
  }

  focusOnStop(stopId) {
    const s = STOPS[stopId];
    this.controls.target.set(s.x, 2, s.z);
    this.camera.position.set(s.x + 30, 40, s.z + 30);
    this.controls.update();
  }

  // ── Render ──────────────────────────────────────────────────────

  render() {
    this.controls.update();
    if (this.useComposer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.useComposer) {
      this.composer.setSize(w, h);
    }
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    if (this.mapTexture) this.mapTexture.dispose();
    this.renderer.dispose();
    this.controls.dispose();
  }
}

