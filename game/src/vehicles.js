// vehicles.js — car factory (sedans, sports, vans, trucks, cop cars) and the
// arcade car handling model shared by the player, traffic and police.
import { clamp, lerp, angleLerp } from './rng.js';

export const CAR_COLORS = [0xe2543e, 0x3e92cc, 0xf2c14e, 0x7bd0a8, 0xf5f2ea, 0x33404d, 0xff8c42, 0xc39bff, 0x8a93a0, 0x279ea8];
const BODY_TYPES = {
  sedan: { w: 1.9, l: 4.4, h: 0.62, cabL: 2.2, topSpeed: 34, accel: 15 },
  sports: { w: 1.95, l: 4.3, h: 0.5, cabL: 1.8, topSpeed: 46, accel: 22 },
  van: { w: 2.1, l: 5.2, h: 1.1, cabL: 3.4, topSpeed: 27, accel: 11 },
  truck: { w: 2.2, l: 6.4, h: 0.9, cabL: 1.6, topSpeed: 25, accel: 10 },
  taxi: { w: 1.9, l: 4.4, h: 0.62, cabL: 2.2, topSpeed: 34, accel: 15 },
  cop: { w: 1.95, l: 4.6, h: 0.62, cabL: 2.2, topSpeed: 42, accel: 20 },
};
const _mats = {};
function mat(color) {
  if (!_mats[color]) _mats[color] = new THREE.MeshPhongMaterial({ color, shininess: 60 });
  return _mats[color];
}
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1c2836, shininess: 120 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
const chromeMat = new THREE.MeshPhongMaterial({ color: 0xd8dde2, shininess: 140 });

export function makeCarMesh(type, color) {
  const spec = BODY_TYPES[type] || BODY_TYPES.sedan;
  const g = new THREE.Group();
  const bodyColor = type === 'cop' ? 0xf2f3f5 : type === 'taxi' ? 0xf7b731 : color;
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), mat(bodyColor));
  body.position.y = 0.55; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.92, 0.22, spec.l * 0.3), mat(bodyColor));
  hood.position.set(0, 0.92, spec.l * 0.32); g.add(hood);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.84, 0.55, spec.cabL), glassMat);
  cab.position.set(0, 1.12, type === 'truck' ? spec.l * 0.28 : -spec.l * 0.05); g.add(cab);
  if (type === 'cop') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.04, 0.3, spec.l * 0.96), mat(0x20304a));
    stripe.position.y = 0.5; g.add(stripe);
    const bar = new THREE.Group(); bar.position.set(0, 1.5, -0.2);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.32; bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.x = 0.32; bar.add(blue);
    g.add(bar); g.userData.lightBar = { red, blue };
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.24, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe98a }));
    sign.position.set(0, 1.5, -0.2); g.add(sign);
  }
  if (type === 'sports') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.95, 0.08, 0.5), mat(0x22242a));
    wing.position.set(0, 1.05, -spec.l * 0.44); g.add(wing);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheels = [];
  for (const [wx, wz] of [[-spec.w / 2, spec.l * 0.32], [spec.w / 2, spec.l * 0.32], [-spec.w / 2, -spec.l * 0.32], [spec.w / 2, -spec.l * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.7, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0x555544 }));
  hl.position.set(0, 0.62, spec.l / 2 + 0.02); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.7, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0x441111 }));
  tl.position.set(0, 0.62, -spec.l / 2 - 0.02); g.add(tl);
  // headlight cones for night driving (only lit for the player's car + cops)
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 13, 12, 1, true), coneMat);
  cone.rotation.x = Math.PI / 2 + 0.12; cone.position.set(0, 0.55, spec.l / 2 + 6);
  g.add(cone);
  g.userData.wheels = wheels; g.userData.headlight = hl; g.userData.taillight = tl; g.userData.cone = cone;
  g.userData.spec = spec;
  return g;
}

export class Car {
  constructor(scene, type, color, x, z, angle = 0) {
    this.type = type; this.spec = BODY_TYPES[type] || BODY_TYPES.sedan;
    this.mesh = makeCarMesh(type, color);
    this.mesh.position.set(x, 0, z);
    this.x = x; this.z = z; this.angle = angle;
    this.speed = 0; this.health = 100; this.dead = false;
    this.steerVis = 0; this.airborne = 0; this.vy = 0; this.y = 0;
    this.driver = null; this.parked = false; this.smokeT = 0;
    this.id = Math.random();
    scene.add(this.mesh);
    this.syncMesh(0);
  }
  get pos() { return this.mesh.position; }
  forward() { return { x: Math.sin(this.angle), z: Math.cos(this.angle) }; }
  // Arcade handling: throttle -1..1, steer -1..1, handbrake flag.
  drive(dt, throttle, steer, handbrake, particles, sound) {
    const spec = this.spec;
    if (this.dead) throttle = 0;
    const maxF = spec.topSpeed, maxR = -11;
    if (throttle > 0) this.speed += spec.accel * throttle * dt * (1 - this.speed / (maxF * 1.25));
    else if (throttle < 0) {
      if (this.speed > 0.6) this.speed -= 30 * dt; // braking
      else this.speed = Math.max(maxR, this.speed + spec.accel * throttle * dt);
    } else {
      this.speed -= this.speed * 0.55 * dt;
      if (Math.abs(this.speed) < 0.08) this.speed = 0;
    }
    this.speed = clamp(this.speed, maxR, maxF);
    const grip = handbrake ? 0.45 : 1;
    const steerAuthority = clamp(Math.abs(this.speed) / 7, 0, 1) * (handbrake ? 1.5 : 1);
    const turnRate = steer * 1.55 * steerAuthority * grip * (this.speed < 0 ? -1 : 1);
    this.angle += turnRate * dt * clamp(Math.abs(this.speed) / 10, 0.25, 1);
    this.steerVis = lerp(this.steerVis, steer, dt * 8);
    const f = this.forward();
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    // airborne over stunt ramps: simple ballistic hop
    if (this.airborne > 0) {
      this.airborne -= dt; this.vy -= 22 * dt; this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y <= 0) { this.airborne = 0; if (particles) particles.dust(nx, 0.4, nz, 8); }
    }
    this.x = nx; this.z = nz;
    // tyre smoke + skid feel
    const sliding = Math.abs(turnRate) > 0.9 && Math.abs(this.speed) > 9;
    if ((sliding || handbrake) && Math.abs(this.speed) > 6 && particles && Math.random() < 0.5) {
      particles.smoke(this.x - f.x * 1.6, 0.3, this.z - f.z * 1.6, 1);
      if (sound) sound.squeal(true);
    }
    if (this.health < 45 && !this.dead && particles) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { particles.smoke(this.x, 1.1, this.z, 2); this.smokeT = 0.12; }
    }
    this.syncMesh(dt);
    return sliding;
  }
  collideWorld(city, particles, sound) {
    const r = 1.55;
    const before = { x: this.x, z: this.z };
    const [nx, nz] = city.collide(this.x, this.z, r);
    const hitDist = Math.hypot(nx - before.x, nz - before.z);
    if (hitDist > 0.05) {
      const impact = Math.abs(this.speed) * hitDist * 3;
      if (Math.abs(this.speed) > 7 && impact > 4) {
        this.damage(impact * 0.55);
        if (particles) particles.sparks(this.x, 0.7, this.z, 8);
        if (sound) sound.crash(clamp(impact / 40, 0.1, 0.6));
        this.speed *= -0.25;
      } else this.speed *= 0.6;
      this.x = nx; this.z = nz;
    }
    // keep cars on the island and out of the sea / canal
    if (city.isWater(this.x, this.z)) {
      this.x = clamp(this.x, -266, 266); this.z = clamp(this.z, -266, 266);
      if (city.isWater(this.x, this.z)) { this.x = before.x; this.z = before.z; }
      this.speed *= 0.5;
    }
    this.x = clamp(this.x, -272, 272); this.z = clamp(this.z, -272, 272);
  }
  collideCar(other, particles, sound) {
    const d = Math.hypot(this.x - other.x, this.z - other.z);
    const min = 3.1;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2, ux = (this.x - other.x) / d, uz = (this.z - other.z) / d;
      this.x += ux * push; this.z += uz * push;
      other.x -= ux * push; other.z -= uz * push;
      const rel = Math.abs(this.speed - other.speed);
      if (rel > 6) {
        this.damage(rel * 0.5); other.damage(rel * 0.5);
        if (particles) particles.sparks((this.x + other.x) / 2, 0.7, (this.z + other.z) / 2, 10);
        if (sound) sound.crash(0.35);
        this.speed *= 0.45; other.speed *= 0.45;
        return rel;
      }
    }
    return 0;
  }
  damage(n) {
    if (this.dead) return;
    this.health -= n;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
    this.mesh.children[0].material = this.mesh.children[0].material; // keep shared paint; dents are implied by smoke/fire state
  }
  syncMesh(dt) {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(0, this.angle, 0);
    // body roll and pitch sell the arcade feel
    this.mesh.rotation.z = -this.steerVis * clamp(Math.abs(this.speed) / 30, 0, 1) * 0.07;
    this.mesh.rotation.x = clamp(-(this.speed - (this._lastSpeed || 0)) * 0.004, -0.05, 0.05);
    this._lastSpeed = this.speed;
    const spin = this.speed * dt * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    if (this.mesh.userData.wheels[0]) {
      this.mesh.userData.wheels[0].rotation.y = this.steerVis * 0.4;
      this.mesh.userData.wheels[1].rotation.y = this.steerVis * 0.4;
    }
  }
  setNightLights(on, isPlayer) {
    this.mesh.userData.headlight.material.color.setHex(on ? 0xfff6c9 : 0x555544);
    this.mesh.userData.taillight.material.color.setHex(on ? 0xff3333 : 0x441111);
    this.mesh.userData.cone.material.opacity = on && isPlayer ? 0.13 : 0;
  }
  flashBar(t) {
    const bar = this.mesh.userData.lightBar;
    if (!bar) return;
    const on = Math.sin(t * 14) > 0;
    bar.red.material.color.setHex(on ? 0xff2222 : 0x551111);
    bar.blue.material.color.setHex(on ? 0x2255ff : 0x111155);
  }
  dispose(scene) { scene.remove(this.mesh); }
}
export { angleLerp };
