// city.js — Coral Bay island: layout grid, districts, buildings with lit
// windows, street props, marina, port, beach, sea, buoys and shell pickups.
import { clamp, lerp } from './rng.js';

export const ROADS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const ROAD_W = 15;
export const ISLAND = 268;

export const LOCATIONS = {
  start: { x: -138, z: 208, name: 'Marina Promenade' },
  cafe: { x: -52, z: 196, name: "Rosa's Café" },
  rosaHouse: { x: -196, z: -34, name: "Aunt Rosa's House" },
  portGate: { x: 196, z: 66, name: 'Port Gate' },
  portYard: { x: 222, z: -24, name: 'Port Yard' },
  lockup: { x: 34, z: -128, name: 'Downtown Lockup' },
  beachParty: { x: -196, z: 238, name: 'Coral Beach' },
  warehouse: { x: 224, z: -96, name: 'Harbour Warehouse' },
  hideout: { x: 96, z: 214, name: 'Marina Hideout' },
  gunCorner: { x: 8, z: -76, name: 'Gun Shop Corner' },
  hospital: { x: -96, z: -150, name: 'Coral Bay Hospital' },
  policeStation: { x: 96, z: -150, name: 'Police Station' },
  marinaPier: { x: -30, z: 262, name: 'Marina Pier' },
  lighthouse: { x: 250, z: 250, name: 'South-East Point' },
};

export function districtAt(x, z) {
  if (x >= 152) return 'port';
  if (z >= 196) return x < -90 ? 'beach' : 'marina';
  if (z >= 128 && x > -170) return 'marina';
  if (Math.abs(x) <= 138 && z <= -28) return 'downtown';
  return 'suburbs';
}
export function isRoadCoord(v) { return ROADS.some(r => Math.abs(v - r) < ROAD_W / 2 + 0.6); }
export function isRoad(x, z) { return isRoadCoord(x) || isRoadCoord(z); }

const PALETTES = {
  downtown: [0x9fb6c9, 0x8fa8bf, 0xb9c8d4, 0x7e97ad, 0xc4d2dc],
  marina: [0xf6d8b0, 0xf3c6c6, 0xfdf0d5, 0xcdeac0, 0xffe5b4],
  beach: [0xfdf0d5, 0xf6d8b0, 0xffe9c9],
  suburbs: [0xe8d8c3, 0xd9e6c3, 0xf3e2c7, 0xe6cfa8, 0xd8e2ee],
  port: [0xa8a29a, 0x96907f, 0xb5ada0, 0x8b93a0],
};

function facadeTextures(rng, baseColor) {
  const w = 128, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#' + baseColor.toString(16).padStart(6, '0'); g.fillRect(0, 0, w, h);
  const e = document.createElement('canvas'); e.width = w; e.height = h;
  const ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h);
  const cols = 6, rows = 12, lit = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = 8 + i * 20, y = 10 + j * 20, on = rng.chance(0.42);
    g.fillStyle = on ? '#ffe9a8' : '#2c3e50';
    g.fillRect(x, y, 12, 13);
    if (on) { ge.fillStyle = rng.pick(['#ffd98a', '#fff3c4', '#ffc4e1', '#a8ecff']); ge.fillRect(x, y, 12, 13); lit.push(1); }
  }
  const map = new THREE.CanvasTexture(c), em = new THREE.CanvasTexture(e);
  return { map, em };
}

export class City {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.colliders = []; this.shells = []; this.buoys = [];
    this.windowMats = []; this.lampHeads = []; this.neonMats = [];
    this.water = null; this.boatMeshes = []; this.trafficLights = [];
    this.build();
  }
  addCollider(x, z, w, d, h = 10) { this.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h }); }
  box(w, h, d, color, x, y, z, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      opts.mat || new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z); if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = false; m.receiveShadow = false;
    this.scene.add(m); return m;
  }
  build() {
    const rng = this.rng, scene = this.scene;
    // Sea and island base
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshPhongMaterial({ color: 0x1b6f8f, transparent: true, opacity: 0.94, shininess: 120 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.55; scene.add(sea); this.water = sea;
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
      new THREE.MeshLambertMaterial({ color: 0xe6cf9e }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.05; scene.add(sand);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(536, 536),
      new THREE.MeshLambertMaterial({ color: 0x8f9296 }));
    base.rotation.x = -Math.PI / 2; base.position.y = 0.0; scene.add(base);
    // Canal across the north-east corner, with bridge decks on the two roads crossing it
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(120, 13),
      new THREE.MeshPhongMaterial({ color: 0x1b6f8f, shininess: 100 }));
    canal.rotation.x = -Math.PI / 2; canal.position.set(210, 0.03, -207); scene.add(canal);
    for (const bx of [180, 240]) {
      const deck = this.box(15, 0.5, 15, 0x6d6f72, bx, 0.26, -207); deck.material = new THREE.MeshLambertMaterial({ color: 0x74767a });
    }
    this.canal = { x0: 150, x1: 270, z0: -213.5, z1: -200.5 };
    this.buildRoads(); this.buildBlocks(); this.buildMarina(); this.buildPort();
    this.buildBeach(); this.buildProps(); this.buildCollectibles();
  }
  buildRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
    const dashGeo = new THREE.BoxGeometry(3.4, 0.06, 0.5);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5eeda });
    const dashes = [];
    for (const r of ROADS) {
      for (const horiz of [true, false]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(536, ROAD_W), roadMat);
        p.rotation.x = -Math.PI / 2;
        if (horiz) p.position.set(0, 0.04, r); else { p.rotation.z = Math.PI / 2; p.position.set(r, 0.04, 0); }
        this.scene.add(p);
        for (let s = -264; s <= 264; s += 11) {
          if (ROADS.some(o => Math.abs(s - o) < 11)) continue;
          dashes.push(horiz ? [s, r] : [r, s]);
        }
      }
    }
    const inst = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
    const m4 = new THREE.Matrix4();
    dashes.forEach(([x, z], i) => { m4.setPosition(x, 0.08, z); inst.setMatrixAt(i, m4); });
    this.scene.add(inst);
    // Traffic lights at main junctions
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
    for (const x of ROADS) for (const z of ROADS) {
      if ((x + z) % 120 !== 0) continue;
      const g = new THREE.Group(); g.position.set(x + 9, 0, z + 9);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.6), poleMat);
      pole.position.y = 2.3; g.add(pole);
      const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.5), poleMat);
      headBox.position.y = 5.1; g.add(headBox);
      const lamps = [];
      [0xff4444, 0xffcc33, 0x44ff77].forEach((c, i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x222222 }));
        s.position.set(0, 5.5 - i * 0.4, -0.28); g.add(s); lamps.push({ mesh: s, color: c });
      });
      this.scene.add(g);
      this.trafficLights.push({ x, z, lamps });
    }
  }
  lightPhase(t) { return Math.floor(t / 7) % 2 === 0 ? 'ns' : 'ew'; }
  buildBlocks() {
    const rng = this.rng;
    const texCache = {};
    const texFor = (district, color) => {
      const key = district + color;
      if (!texCache[key]) {
        const { map, em } = facadeTextures(rng, color);
        const mat = new THREE.MeshLambertMaterial({ map, emissiveMap: em, emissive: 0xffc98a, emissiveIntensity: 0 });
        this.windowMats.push(mat); texCache[key] = mat;
      }
      return texCache[key];
    };
    for (let bi = 0; bi < ROADS.length - 1; bi++) for (let bj = 0; bj < ROADS.length - 1; bj++) {
      const cx = (ROADS[bi] + ROADS[bi + 1]) / 2, cz = (ROADS[bj] + ROADS[bj + 1]) / 2;
      const district = districtAt(cx, cz);
      // block pavement tint
      const tint = { downtown: 0x9aa0a6, marina: 0xd9c9a8, beach: 0xe8d3a0, suburbs: 0x9db38a, port: 0x8a8578 }[district];
      const pave = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshLambertMaterial({ color: tint }));
      pave.rotation.x = -Math.PI / 2; pave.position.set(cx, 0.06, cz); this.scene.add(pave);
      if (district === 'port') continue; // port furniture built separately
      if (district === 'beach' && cz > 200) continue; // open sand at the shore
      const spots = [[-11, -11], [11, -11], [-11, 11], [11, 11]];
      const n = district === 'downtown' ? 4 : district === 'suburbs' ? rng.int(2, 3) : rng.int(3, 4);
      for (let k = 0; k < n; k++) {
        const [ox, oz] = spots[k];
        const x = cx + ox, z = cz + oz;
        const color = rng.pick(PALETTES[district]);
        if (district === 'suburbs') {
          const h = rng.range(3.2, 4.6), w = rng.range(9, 12), d = rng.range(8, 11);
          this.box(w, h, d, color, x, h / 2, z);
          const roof = this.box(w + 1.4, 0.7, d + 1.4, 0xa2543a, x, h + 0.35, z);
          roof.rotation.y = 0; this.addCollider(x, z, w, d, h);
          if (rng.chance(0.7)) this.box(rng.range(2, 4), rng.range(1.4, 2.2), rng.range(2, 3), 0x77a047, x + rng.range(-6, 6), 0.8, z + rng.range(-6, 6));
          continue;
        }
        const tall = district === 'downtown';
        const h = tall ? rng.range(16, 42) : rng.range(6, 13);
        const w = rng.range(11, 16), d = rng.range(11, 16);
        const mat = texFor(district, color);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z); this.scene.add(b);
        this.addCollider(x, z, w, d, h);
        // awning + neon sign in shopping streets and marina hotels
        if (!tall || rng.chance(0.4)) {
          this.box(w * 0.7, 0.3, 2.2, rng.pick([0xe2543e, 0x2ea8a0, 0xf2a03d]), x, 3.1, z + d / 2 + 1);
          if (rng.chance(0.55)) this.neonSign(x, 4.4, z + d / 2 + 0.35, rng.pick(['CAFÉ', 'HOTEL SOL', 'CORAL', 'BAR MAR', 'SURF', 'PALMS', 'TACOS', 'DISCO', 'RAMEN', 'AZUL']), rng.pick([0xff5da2, 0x33e0ff, 0xffb347, 0x9dff57, 0xff6b6b]));
        }
        // rooftop props so rooftops read from the chase camera
        if (h > 9) {
          if (rng.chance(0.6)) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 10), new THREE.MeshLambertMaterial({ color: 0xb08954 })); t.position.set(x + rng.range(-3, 3), h + 1.2, z + rng.range(-3, 3)); this.scene.add(t); }
          else this.box(rng.range(2, 4), 1.1, rng.range(2, 3), 0x9aa0a6, x + rng.range(-3, 3), h + 0.55, z + rng.range(-3, 3));
          if (tall && rng.chance(0.3)) this.billboard(x, h + 3.4, z, rng.pick(['CORAL BAY', 'VUELTA COLA', 'HOTEL SOL', 'MARINA 9', 'AZUL FM']));
        }
      }
    }
  }
  neonSign(x, y, z, text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = '#101018'; g.fillRect(0, 0, 256, 48);
    g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#' + color.toString(16).padStart(6, '0'); g.shadowBlur = 16;
    g.fillStyle = '#ffffff'; g.fillText(text, 128, 25);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.4), mat);
    m.position.set(x, y, z); this.scene.add(m); this.neonMats.push(mat);
    return m;
  }
  billboard(x, y, z, text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#ff7e5f'); grad.addColorStop(1, '#feb47b');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 128);
    g.font = 'bold 58px Arial'; g.textAlign = 'center'; g.fillStyle = '#20303c';
    g.fillText(text, 256, 82);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.2),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = this.rng.range(0, Math.PI);
    this.scene.add(m);
  }
  buildMarina() {
    const rng = this.rng;
    // promenade + two piers reaching into the water
    this.box(300, 0.3, 10, 0xd9c9a8, -20, 0.15, 262);
    for (const px of [-90, -30, 40, 110]) {
      this.box(5, 0.4, 34, 0xa8895c, px, 0.2, 282);
      // moored boats bobbing either side of each pier
      for (const side of [-5.5, 5.5]) {
        const boat = this.makeBoat(rng.pick([0xffffff, 0x3e92cc, 0xe2543e, 0xf2c14e, 0x7bd0a8]));
        boat.position.set(px + side, 0, 282 + rng.range(-10, 10));
        boat.rotation.y = rng.range(-0.2, 0.2);
        this.scene.add(boat); this.boatMeshes.push(boat);
      }
    }
    for (let i = 0; i < 7; i++) { // extra yachts anchored off the marina
      const boat = this.makeBoat(rng.pick([0xffffff, 0xdfe9f2, 0x3e92cc]));
      boat.position.set(-140 + i * 42 + rng.range(-6, 6), 0, 306 + rng.range(-8, 14));
      boat.rotation.y = rng.range(0, Math.PI * 2);
      boat.scale.setScalar(1.35);
      this.scene.add(boat); this.boatMeshes.push(boat);
    }
    // lighthouse at the south-east point
    const lh = new THREE.Group(); lh.position.set(252, 0, 252);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 15, 12), new THREE.MeshLambertMaterial({ color: 0xf3f0e6 }));
    tower.position.y = 7.5; lh.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 3, 12), new THREE.MeshLambertMaterial({ color: 0xe2543e }));
    band.position.y = 10; lh.add(band);
    this.lighthouseLamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), new THREE.MeshBasicMaterial({ color: 0x333322 }));
    this.lighthouseLamp.position.y = 15.8; lh.add(this.lighthouseLamp);
    this.scene.add(lh); this.addCollider(252, 252, 6, 6, 15);
  }
  makeBoat(color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 8), new THREE.MeshLambertMaterial({ color }));
    hull.position.y = 0.1; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 4), new THREE.MeshLambertMaterial({ color }));
    bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.1, 5.1); bow.scale.y = 1; g.add(bow);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 3), new THREE.MeshLambertMaterial({ color: 0xf5f2ea }));
    cabin.position.set(0, 1.1, -0.6); g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6), new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
    mast.position.set(0, 3.4, 1.4); g.add(mast);
    return g;
  }
  buildPort() {
    const rng = this.rng;
    // warehouses
    for (const [x, z, w, d] of [[205, 20, 34, 20], [205, 100, 34, 24], [222, -60, 26, 30], [200, 160, 30, 20], [232, 130, 20, 26]]) {
      const h = rng.range(8, 12);
      this.box(w, h, d, rng.pick(PALETTES.port), x, h / 2, z);
      this.box(w + 1, 0.6, d + 1, 0x707a86, x, h + 0.3, z);
      this.addCollider(x, z, w, d, h);
    }
    // container stacks — bright corrugated colour blocks
    const contColors = [0xd64541, 0x2e86ab, 0x3fa34d, 0xf2a03d, 0x7d5ba6, 0x279ea8];
    for (let i = 0; i < 26; i++) {
      const x = rng.range(168, 252), z = rng.range(-160, 190);
      if (isRoad(x, z) || districtAt(x, z) !== 'port') continue;
      const levels = rng.int(1, 3);
      for (let l = 0; l < levels; l++)
        this.box(9, 2.6, 3.6, rng.pick(contColors), x, 1.3 + l * 2.6, z, { ry: rng.chance(0.5) ? 0 : Math.PI / 2 });
      this.addCollider(x, z, 9, 4, levels * 2.6);
    }
    // cranes
    for (const [x, z] of [[196, -24], [238, 44], [206, -130]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const mat = new THREE.MeshLambertMaterial({ color: 0xe8873a });
      for (const [lx, lz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 22, 0.9), mat);
        leg.position.set(lx, 11, lz); g.add(leg);
      }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 30), mat);
      arm.position.set(0, 22, 4); g.add(arm);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshLambertMaterial({ color: 0x33404d }));
      cab.position.set(0, 20, 10); g.add(cab);
      this.scene.add(g); this.addCollider(x, z, 9, 7, 22);
    }
    // fuel tanks
    for (const [x, z] of [[176, -176], [196, -176], [238, 196]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 8, 16), new THREE.MeshLambertMaterial({ color: 0xd8d3c8 }));
      t.position.set(x, 4, z); this.scene.add(t); this.addCollider(x, z, 12, 12, 8);
    }
    // stunt ramps at the port and the beach car park
    this.ramps = [];
    for (const [x, z, ry] of [[188, -100, 0], [150, 226, Math.PI], [236, 84, -Math.PI / 2]]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 9), new THREE.MeshLambertMaterial({ color: 0xf2a03d }));
      ramp.position.set(x, 1.1, z); ramp.rotation.x = -0.42; ramp.rotation.y = ry;
      this.scene.add(ramp); this.ramps.push({ x, z, r: 7 });
    }
  }
  buildBeach() {
    const rng = this.rng;
    // lifeguard tower
    const g = new THREE.Group(); g.position.set(-196, 0, 246);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    hut.position.y = 4.4; g.add(hut);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 3.8), new THREE.MeshLambertMaterial({ color: 0xe2543e }));
    roof.position.y = 5.8; g.add(roof);
    for (const [lx, lz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), new THREE.MeshLambertMaterial({ color: 0xa8895c }));
      leg.position.set(lx, 1.7, lz); g.add(leg);
    }
    this.scene.add(g); this.addCollider(-196, 246, 3.4, 3, 5);
    // beach umbrellas and towels
    for (let i = 0; i < 16; i++) {
      const x = rng.range(-250, -110), z = rng.range(232, 262);
      const um = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 8), new THREE.MeshLambertMaterial({ color: rng.pick([0xe2543e, 0x2ea8a0, 0xf2c14e, 0xff5da2]) }));
      um.position.set(x, 1.6, z); this.scene.add(um);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      pole.position.set(x, 0.85, z); this.scene.add(pole);
    }
  }
  buildProps() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    const palmMat = new THREE.MeshLambertMaterial({ color: 0x3fa34d });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
    const treeSpots = [];
    for (let i = 0; i < 260 && treeSpots.length < 150; i++) {
      const x = rng.range(-258, 258), z = rng.range(-258, 258);
      if (isRoad(x, z) || this.insideCollider(x, z, 2)) continue;
      treeSpots.push([x, z]);
    }
    for (const [x, z] of treeSpots) {
      const palm = districtAt(x, z) === 'beach' || districtAt(x, z) === 'marina' || rng.chance(0.4);
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, palm ? 4.6 : 2.6, 6), trunkMat);
      trunk.position.y = (palm ? 4.6 : 2.6) / 2; trunk.rotation.z = palm ? rng.range(-0.1, 0.1) : 0; g.add(trunk);
      if (palm) {
        for (let f = 0; f < 5; f++) {
          const frond = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.7), palmMat);
          frond.position.y = 4.7; frond.rotation.y = (f / 5) * Math.PI * 2; frond.rotation.z = 0.5;
          frond.translateX(1.4); g.add(frond);
        }
      } else {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(rng.range(1.6, 2.4), 8, 7), leafMat);
        crown.position.y = 3.6; g.add(crown);
      }
      this.scene.add(g);
      this.addCollider(x, z, 0.7, 0.7, 3);
    }
    // lamp posts along every road — heads glow at night
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    for (const r of ROADS) for (let s = -252; s <= 252; s += 42) {
      for (const [x, z] of [[s, r + 9], [r + 9, s]]) {
        if (Math.abs(x) > 262 || Math.abs(z) > 262) continue;
        const g = new THREE.Group(); g.position.set(x, 0, z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.4), lampMat);
        pole.position.y = 2.7; g.add(pole);
        const headMat = new THREE.MeshBasicMaterial({ color: 0x444038 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), headMat);
        head.position.y = 5.5; g.add(head);
        this.lampHeads.push(headMat);
        this.scene.add(g);
      }
    }
    // benches, hydrants, crates, dumpsters near sidewalks
    for (let i = 0; i < 70; i++) {
      const r = rng.pick(ROADS), s = rng.range(-255, 255), side = rng.sign();
      const horiz = rng.chance(0.5);
      const x = horiz ? s : r + side * 10, z = horiz ? r + side * 10 : s;
      if (this.insideCollider(x, z, 1)) continue;
      const kind = rng.int(0, 3);
      if (kind === 0) this.box(2.2, 0.5, 0.6, 0x8a6f4d, x, 0.45, z);
      else if (kind === 1) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0xd64541 })); h.position.set(x, 0.4, z); this.scene.add(h); }
      else if (kind === 2) { this.box(1.1, 1.1, 1.1, 0xa8895c, x, 0.55, z); this.addCollider(x, z, 1.1, 1.1, 1.1); }
      else { this.box(2.2, 1.3, 1.2, 0x4a7a52, x, 0.65, z); this.addCollider(x, z, 2.2, 1.2, 1.3); }
    }
    // café marker building dressing at Rosa's
    this.neonSign(LOCATIONS.cafe.x, 4.6, LOCATIONS.cafe.z + 6, "ROSA'S CAFÉ", 0xff5da2);
    this.neonSign(LOCATIONS.gunCorner.x, 4.6, LOCATIONS.gunCorner.z - 6, 'GUNS & AMMO', 0xffb347);
  }
  buildCollectibles() {
    const rng = this.rng;
    // 22 golden shells — piers, alleys, beach, park corners, low awnings
    const shellSpots = [
      [-90, 296], [-30, 296], [40, 296], [110, 296], [-196, 252], [-160, 244], [-238, 240],
      [-52, 188], [96, 206], [8, -84], [188, -93], [150, 219], [-128, 128], [64, 64],
      [-64, -64], [128, -128], [-190, -120], [70, -190], [-240, 60], [30, 130],
      [-105, -15], [215, 250],
    ];
    const shellGeo = new THREE.SphereGeometry(0.55, 10, 8);
    const shellMat = new THREE.MeshPhongMaterial({ color: 0xffc93c, emissive: 0xaa7700, shininess: 90 });
    shellSpots.forEach(([x, z], i) => {
      const m = new THREE.Mesh(shellGeo, shellMat);
      m.scale.set(1, 0.55, 1); m.position.set(x, 0.8, z);
      this.scene.add(m);
      this.shells.push({ x, z, mesh: m, taken: false, id: i });
    });
    // 14 neon buoys ringing the island, close enough to wade to from shore or pier
    const buoySpots = [
      [-90, 300], [-30, 302], [40, 300], [110, 298], [180, 292], [284, 180], [288, 60],
      [284, -80], [240, -286], [120, -290], [-40, -288], [-180, -284], [-288, -60], [-286, 120],
    ];
    const buoyColors = [0xff5da2, 0x33e0ff, 0x9dff57, 0xffb347];
    buoySpots.forEach(([x, z], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const color = buoyColors[i % buoyColors.length];
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 1.2, 10),
        new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.85 }));
      body.position.y = 0.1; g.add(body);
      const lampMat = new THREE.MeshBasicMaterial({ color });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8), lampMat);
      lamp.position.y = 1.1; g.add(lamp);
      this.scene.add(g);
      this.buoys.push({ x, z, mesh: g, lampMat, taken: false, id: i, phase: rng.range(0, 6) });
    });
  }
  insideCollider(x, z, pad = 0) {
    return this.colliders.some(c => x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad);
  }
  collide(x, z, r) {
    // circle vs building AABBs — push out on the smaller penetration axis
    for (const c of this.colliders) {
      if (c.h < 0.6) continue;
      const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        else { // centre inside the box: exit through the nearest face
          const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
        }
      }
    }
    return [x, z];
  }
  isWater(x, z) {
    if (Math.abs(x) > ISLAND + 4 || Math.abs(z) > ISLAND + 4) return true;
    return x > this.canal.x0 && x < this.canal.x1 && z > this.canal.z0 && z < this.canal.z1;
  }
  groundY(x, z) { return this.isWater(x, z) ? -0.5 : 0; }
  lightFor(t) { return this.lightPhase(t); }
  update(dt, t, nightFactor) {
    if (this.water) { this.water.position.y = -0.55 + Math.sin(t * 0.7) * 0.06; this.water.rotation.z = Math.sin(t * 0.05) * 0.004; }
    for (const b of this.boatMeshes) {
      b.position.y = -0.15 + Math.sin(t * 0.9 + b.position.x * 0.4) * 0.14;
      b.rotation.z = Math.sin(t * 0.7 + b.position.z) * 0.03;
    }
    for (const s of this.shells) if (!s.taken) { s.mesh.rotation.y += dt * 2.2; s.mesh.position.y = 0.8 + Math.sin(t * 2.4 + s.id) * 0.15; }
    for (const b of this.buoys) {
      b.mesh.position.y = -0.2 + Math.sin(t * 1.3 + b.phase) * 0.22;
      b.mesh.rotation.x = Math.sin(t + b.phase) * 0.08;
      const glow = 0.55 + nightFactor * 0.9 + Math.sin(t * 3 + b.phase) * 0.25;
      b.lampMat.color.setHex(b.id % 4 === 0 ? 0xff5da2 : b.id % 4 === 1 ? 0x33e0ff : b.id % 4 === 2 ? 0x9dff57 : 0xffb347);
      b.mesh.children[0].material.emissiveIntensity = glow;
    }
    for (const m of this.windowMats) m.emissiveIntensity = nightFactor * 1.15;
    for (const h of this.lampHeads) h.color.setHex(nightFactor > 0.35 ? 0xffd9a0 : 0x444038);
    if (this.lighthouseLamp) this.lighthouseLamp.material.color.setHex(nightFactor > 0.3 && Math.sin(t * 1.4) > 0 ? 0xfff2b0 : 0x333322);
    const phase = this.lightPhase(t);
    for (const tl of this.trafficLights) {
      tl.lamps.forEach((l, i) => {
        const active = (phase === 'ns' && i === 2) || (phase === 'ew' && i === 0);
        l.mesh.material.color.setHex(active ? l.color : 0x1c1c1c);
      });
    }
  }
}
export { lerp };
