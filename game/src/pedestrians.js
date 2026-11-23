// pedestrians.js — humanoid figures and the crowd system: pavement walkers,
// crosswalk users, idlers at shop fronts, and people who flee screaming.
import { ROADS } from './city.js';
import { clamp } from './rng.js';

const SKIN = [0xf2c79b, 0xd9a066, 0xa06a35, 0x7a4a21, 0xffe0bd];
const SHIRTS = [0xe2543e, 0x3e92cc, 0xf2c14e, 0x7bd0a8, 0xff5da2, 0xf5f2ea, 0x279ea8, 0xff8c42, 0x33404d, 0xc39bff];
const PANTS = [0x33404d, 0x5d6d7e, 0x8a6f4d, 0x2c3e50, 0xe8e2d4, 0x71563f];

export function makeHuman(rng, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin || rng.pick(SKIN) });
  const shirt = new THREE.MeshLambertMaterial({ color: opts.shirt || rng.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants || rng.pick(PANTS) });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pants); legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt); torso.position.y = 1.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), shirt); armL.position.set(-0.4, 1.18, 0);
  const armR = armL.clone(); armR.position.x = 0.4;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin); head.position.y = 1.78;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 10, 6), new THREE.MeshLambertMaterial({ color: rng.pick([0x2c1c10, 0x4a2f18, 0x111111, 0x8a6f4d, 0xd9c9a8]) }));
  hair.position.y = 1.84; hair.scale.y = 0.75;
  g.add(legL, legR, torso, armL, armR, head, hair);
  g.userData.parts = { legL, legR, armL, armR, torso, head };
  if (opts.gun) {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x17181c }));
    gun.position.set(0.4, 1.1, 0.3); g.add(gun); g.userData.gun = gun;
  }
  if (opts.uniform) { // police officer: navy + cap
    torso.material = new THREE.MeshLambertMaterial({ color: 0x20304a });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x182740 }));
    cap.position.y = 1.97; g.add(cap);
  }
  return g;
}

export class Ped {
  constructor(scene, rng, x, z, opts = {}) {
    this.mesh = makeHuman(rng, opts);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z; this.angle = rng.range(0, Math.PI * 2);
    this.speed = 0; this.walkPhase = rng.range(0, 6);
    this.health = opts.health || 30; this.dead = false; this.downT = 0;
    this.state = 'walk'; this.fleeT = 0; this.fleeFrom = null;
    this.target = null; this.idleT = 0; this.hostile = !!opts.hostile;
    this.shootCd = rng.range(0.5, 1.5); this.strafeDir = rng.sign();
    this.rng = rng;
    this.pickSidewalkTarget(rng);
  }
  pickSidewalkTarget(rng) {
    // stroll: pick a point along a nearby pavement line
    const horiz = rng.chance(0.5), line = rng.pick(ROADS), side = rng.sign();
    const s = clamp((horiz ? this.x : this.z) + rng.range(-70, 70), -256, 256);
    this.target = horiz ? { x: s, z: line + side * 10.6 } : { x: line + side * 10.6, z: s };
    if (rng.chance(0.16)) this.idleT = rng.range(2, 6); // pause at a shop front / bus stop
  }
  fleeFromPoint(x, z) { this.state = 'flee'; this.fleeT = 3.2; this.fleeFrom = { x, z }; }
  knockDown() { if (!this.dead) { this.downT = 2.6; this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.y = 0.25; } }
  hurt(n, particles) {
    this.health -= n;
    if (particles) particles.burst(this.x, 1.3, this.z, 5, 0xcc3333, 2.5, 0.4, 1, -4);
    if (this.health <= 0 && !this.dead) { this.dead = true; this.knockDown(); this.downT = 9999; }
    else if (!this.dead) this.fleeFromPoint(this.x + (Math.random() - 0.5), this.z + (Math.random() - 0.5));
  }
  update(dt, ctx) {
    if (this.dead || this.downT > 0) { this.downT -= dt; if (!this.dead && this.downT <= 0) { this.mesh.rotation.x = 0; this.mesh.position.y = 0; } return; }
    let tx = null, tz = null, want = 1.45;
    if (this.state === 'flee' && this.fleeFrom) {
      this.fleeT -= dt;
      const dx = this.x - this.fleeFrom.x, dz = this.z - this.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
      tx = this.x + (dx / d) * 26; tz = this.z + (dz / d) * 26; want = 4.6;
      if (this.fleeT <= 0) { this.state = 'walk'; this.pickSidewalkTarget(this.rng); }
    } else if (this.idleT > 0) {
      this.idleT -= dt; want = 0;
    } else if (this.target) {
      tx = this.target.x; tz = this.target.z;
      if (Math.hypot(tx - this.x, tz - this.z) < 1.6) this.pickSidewalkTarget(this.rng);
    }
    if (tx !== null && want > 0) {
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1;
      const desired = Math.atan2(dx, dz);
      let diff = desired - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += clamp(diff, -3.4 * dt, 3.4 * dt);
      this.speed = want;
      this.x += Math.sin(this.angle) * this.speed * dt;
      this.z += Math.cos(this.angle) * this.speed * dt;
      const [cx, cz] = ctx.city.collide(this.x, this.z, 0.42);
      this.x = clamp(cx, -266, 266); this.z = clamp(cz, -266, 266);
    } else this.speed = 0;
    // walk-cycle animation
    this.walkPhase += dt * (this.speed > 3 ? 11 : 7) * (this.speed > 0 ? 1 : 0);
    const p = this.mesh.userData.parts, s = Math.sin(this.walkPhase) * (this.speed > 0 ? 0.55 : 0);
    p.legL.rotation.x = s; p.legR.rotation.x = -s;
    p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
    if (this.state === 'flee') { p.armL.rotation.x = -2.6; p.armR.rotation.x = -2.6; }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }
  dispose(scene) { scene.remove(this.mesh); }
}

export class Crowd {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng; this.peds = [];
    for (let i = 0; i < 52; i++) {
      const horiz = rng.chance(0.5), line = rng.pick(ROADS), side = rng.sign(), s = rng.range(-250, 250);
      const x = horiz ? s : line + side * 10.6, z = horiz ? line + side * 10.6 : s;
      this.peds.push(new Ped(scene, rng, x, z));
    }
  }
  panicAt(x, z, r = 34) { for (const p of this.peds) if (Math.hypot(p.x - x, p.z - z) < r) p.fleeFromPoint(x, z); }
  update(dt, ctx) { for (const p of this.peds) p.update(dt, ctx); }
}
