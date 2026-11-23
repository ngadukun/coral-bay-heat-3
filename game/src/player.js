// player.js — Marina "Mari" Solano on foot: camera-relative movement, sprint,
// jump, wading, punching and pistol combat, health and regeneration.
import { makeHuman } from './pedestrians.js';
import { clamp } from './rng.js';

export class Player {
  constructor(scene, rng, x, z) {
    this.mesh = makeHuman(rng, { shirt: 0xff6b5e, pants: 0xf5f2ea, skin: 0xd9a066 });
    scene.add(this.mesh);
    this.x = x; this.z = z; this.y = 0; this.vy = 0;
    this.angle = Math.PI; this.speed = 0; this.walkPhase = 0;
    this.health = 100; this.hurtT = 0; this.regenDelay = 0;
    this.car = null; this.pistol = false; this.ammo = 0;
    this.shootCd = 0; this.punchCd = 0; this.dead = false;
    this.inWater = false;
  }
  get pos() { return this.mesh.position; }
  hurt(n, ctx) {
    if (this.dead) return;
    this.health -= n; this.regenDelay = 5;
    if (ctx && ctx.sound) ctx.sound.punch();
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }
  healFull() { this.health = 100; this.dead = false; }
  update(dt, ctx) {
    const { input, city, sound } = ctx;
    this.regenDelay -= dt;
    if (this.regenDelay <= 0 && this.health > 0) this.health = Math.min(100, this.health + dt * 5);
    this.shootCd -= dt; this.punchCd -= dt;
    if (this.car) {
      this.x = this.car.x; this.z = this.car.z; this.y = this.car.y;
      this.angle = this.car.angle;
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    // movement relative to the camera yaw
    let mx = 0, mz = 0;
    if (input.down('KeyW')) mz -= 1;
    if (input.down('KeyS')) mz += 1;
    if (input.down('KeyA')) mx -= 1;
    if (input.down('KeyD')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    this.inWater = city.isWater(this.x, this.z);
    const base = this.inWater ? 2.4 : sprint ? 7.6 : 4.6;
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const cy = ctx.camYaw;
      const wx = mx * Math.cos(cy) - mz * Math.sin(cy);
      const wz = mx * Math.sin(cy) + mz * Math.cos(cy);
      // note: camera forward on ground is (-sin cy, -cos cy) for mz=-1 (W)
      const fx = -Math.sin(cy), fz = -Math.cos(cy);
      const rx = Math.cos(cy), rz = -Math.sin(cy);
      const vx = fx * -mz + rx * mx, vz = fz * -mz + rz * mx;
      this.angle = Math.atan2(vx, vz);
      this.x += vx * base * dt; this.z += vz * base * dt;
      this.speed = base;
      void wx; void wz;
    } else this.speed = 0;
    // jump
    if (input.hit('Space') && this.y <= 0.01 && !this.inWater) this.vy = 7.5;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= 20 * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    const [cx, cz] = city.collide(this.x, this.z, 0.45);
    this.x = clamp(cx, -292, 292); this.z = clamp(cz, -292, 292);
    // animate
    this.walkPhase += dt * (sprint ? 11 : 8) * (moving ? 1 : 0);
    const p = this.mesh.userData.parts, s = Math.sin(this.walkPhase) * (moving ? 0.6 : 0);
    p.legL.rotation.x = s; p.legR.rotation.x = -s;
    p.armL.rotation.x = -s * 0.85; p.armR.rotation.x = s * 0.85;
    if (ctx.aiming) { p.armR.rotation.x = -1.35; }
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
    this.mesh.position.set(this.x, this.y + bob + (this.inWater ? -0.35 : 0), this.z);
    this.mesh.rotation.y = this.angle;
    if (sound && this.inWater && moving && Math.random() < dt * 2) ctx.particles.spray(this.x, 0.2, this.z, 2);
  }
  tryPunch(ctx) {
    if (this.punchCd > 0 || this.car) return false;
    this.punchCd = 0.38;
    ctx.sound.punch();
    const fx = Math.sin(this.angle), fz = Math.cos(this.angle);
    let hit = false;
    const check = (t, isOfficer) => {
      const dx = t.x - this.x, dz = t.z - this.z;
      if (dx * fx + dz * fz > 0 && Math.hypot(dx, dz) < 1.9) {
        t.hurt(isOfficer ? 14 : 10, ctx.particles); hit = true;
        ctx.particles.dust(t.x, 1.2, t.z, 4);
      }
    };
    for (const p of ctx.crowd.peds) check(p, false);
    for (const o of ctx.police.officers()) check(o, true);
    if (hit) ctx.wanted.crime(18, ctx);
    return hit;
  }
  tryShoot(ctx) {
    if (!this.pistol || this.ammo <= 0 || this.shootCd > 0 || this.car) return false;
    this.shootCd = 0.24; this.ammo--;
    ctx.sound.shot();
    // aim along the camera forward, pick the best target in a cone
    const fx = -Math.sin(ctx.camYaw) * Math.cos(ctx.camPitch), fz = -Math.cos(ctx.camYaw) * Math.cos(ctx.camPitch);
    this.angle = Math.atan2(fx, fz);
    const ox = this.x, oz = this.z;
    let best = null, bestScore = 0.94;
    const consider = (t, kind) => {
      const dx = t.x - ox, dz = t.z - oz, d = Math.hypot(dx, dz);
      if (d > 46 || d < 0.5) return;
      const dot = (dx * fx + dz * fz) / d;
      if (dot > bestScore) { bestScore = dot; best = { t, kind, d }; }
    };
    for (const p of ctx.crowd.peds) if (!p.dead) consider(p, 'ped');
    for (const o of ctx.police.officers()) if (!o.dead) consider(o, 'officer');
    for (const c of ctx.allCars()) consider(c, 'car');
    const muzzle = { x: ox + fx * 0.6, z: oz + fz * 0.6 };
    if (best) {
      const t = best.t;
      ctx.particles.sparks(t.x, 1.2, t.z, 6);
      for (let i = 1; i <= 4; i++) ctx.particles.spawn(muzzle.x + fx * best.d * (i / 4), 1.35, muzzle.z + fz * best.d * (i / 4), 0, 0, 0, 0.07, 1, 0.85, 0.3, 0);
      if (best.kind === 'car') { best.t.damage(9); if (best.t.traffic) best.t.traffic.panicT = 3; }
      else { best.t.hurt(best.kind === 'officer' ? 16 : 14, ctx.particles); }
      ctx.wanted.crime(best.kind === 'officer' ? 55 : 30, ctx);
    } else {
      for (let i = 1; i <= 5; i++) ctx.particles.spawn(muzzle.x + fx * i * 6, 1.35, muzzle.z + fz * i * 6, 0, 0, 0, 0.06, 1, 0.85, 0.3, 0);
      ctx.wanted.crime(16, ctx);
    }
    ctx.traffic.panicAt(this.x, this.z, 42);
    ctx.crowd.panicAt(this.x, this.z, 36);
    ctx.shake = Math.min(0.5, (ctx.shake || 0) + 0.12);
    return true;
  }
}
