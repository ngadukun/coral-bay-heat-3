// police.js — the wanted system and Coral Bay PD: pursuit cars that ram and
// box in, roadblocks at three stars, officers who get out and shoot.
import { ROADS } from './city.js';
import { Car } from './vehicles.js';
import { Ped } from './pedestrians.js';
import { clamp } from './rng.js';

export class Wanted {
  constructor() { this.heat = 0; this.unseenT = 0; this.forced = 0; }
  get stars() { return clamp(Math.ceil(Math.max(this.heat, this.forced * 100) / 100), 0, 5); }
  crime(points, ctx) {
    this.heat = clamp(this.heat + points, 0, 500);
    this.unseenT = 0;
    if (ctx) { ctx.traffic.panicAt(ctx.player.x, ctx.player.z, 30); }
  }
  setForced(stars) { this.forced = stars; if (stars === 0) this.heat = Math.min(this.heat, 0); }
  update(dt, seen) {
    if (seen) this.unseenT = 0; else this.unseenT += dt;
    if (this.unseenT > 6 && this.forced === 0) this.heat = Math.max(0, this.heat - dt * 5.5);
  }
  clear() { this.heat = 0; this.forced = 0; }
}

const DESIRED = [0, 2, 3, 5, 7, 9];
export class Police {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.units = []; // {car, officer, mode}
    this.blocks = []; this.blockT = 12; this.spawnT = 0;
  }
  spawnUnit(player) {
    const rng = this.rng;
    const horiz = rng.chance(0.5), line = rng.pick(ROADS);
    const along = clamp((horiz ? player.x : player.z) + rng.sign() * rng.range(75, 115), -255, 255);
    const x = horiz ? along : line, z = horiz ? line : along;
    const car = new Car(this.scene, 'cop', 0xffffff, x, z, rng.range(0, 6.28));
    this.units.push({ car, officer: null, mode: 'car', stuckT: 0 });
  }
  spawnBlock(player) {
    // two cop cars parked nose-to-nose across the road ahead of the player
    const f = player.car ? player.car.forward() : { x: Math.sin(player.angle), z: Math.cos(player.angle) };
    const bx = clamp(player.x + f.x * 85, -258, 258), bz = clamp(player.z + f.z * 85, -258, 258);
    const horiz = Math.abs(f.x) > Math.abs(f.z);
    for (const off of [-2.6, 2.6]) {
      const car = new Car(this.scene, 'cop', 0xffffff, horiz ? bx : bx + off, horiz ? bz + off : bz, horiz ? 0 : Math.PI / 2);
      car.parked = true;
      this.blocks.push(car);
    }
  }
  update(dt, ctx) {
    const { player, wanted, city, sound } = ctx;
    const stars = wanted.stars;
    this.spawnT -= dt;
    const want = DESIRED[stars] || 0;
    if (this.units.length < want && this.spawnT <= 0) { this.spawnUnit(player); this.spawnT = 1.6; }
    if (stars === 0) {
      for (const u of this.units) { u.car.dispose(this.scene); if (u.officer) u.officer.dispose(this.scene); }
      this.units = [];
      for (const b of this.blocks) b.dispose(this.scene);
      this.blocks = [];
    }
    // roadblocks at 3+ stars while the player drives
    if (stars >= 3 && player.car) {
      this.blockT -= dt;
      if (this.blockT <= 0) { this.spawnBlock(player); this.blockT = 26; }
    }
    this.blocks = this.blocks.filter(b => {
      if (Math.hypot(b.x - player.x, b.z - player.z) > 190) { b.dispose(this.scene); return false; }
      b.flashBar(ctx.time); return true;
    });
    let nearest = 999;
    for (const u of this.units) {
      const car = u.car;
      car.flashBar(ctx.time);
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      nearest = Math.min(nearest, d);
      if (d > 260) { // recycle far units back into the hunt
        const a = this.rng.range(0, Math.PI * 2);
        car.x = clamp(player.x + Math.cos(a) * 95, -258, 258);
        car.z = clamp(player.z + Math.sin(a) * 95, -258, 258);
        if (city.isWater(car.x, car.z)) { car.x = clamp(player.x, -250, 250); car.z = clamp(player.z, -250, 250); }
      }
      if (u.mode === 'car') {
        // pursuit: aim at a lead point on the player's path
        const lead = player.car ? 0.45 : 0.1;
        const tx = player.x + (player.car ? player.car.forward().x * player.car.speed * lead : Math.sin(player.angle) * lead * 10);
        const tz = player.z + (player.car ? player.car.forward().z * player.car.speed * lead : Math.cos(player.angle) * lead * 10);
        const desired = Math.atan2(tx - car.x, tz - car.z);
        let diff = desired - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = clamp(diff * 1.7, -1, 1);
        let throttle = 1;
        if (Math.abs(diff) > 2.4 && d < 12) throttle = -0.8; // reverse out of a bad angle
        else if (d < 5) throttle = 0.25;
        if (Math.abs(car.speed) < 0.4 && d > 8) { u.stuckT += dt; if (u.stuckT > 2.2) { car.angle += Math.PI; u.stuckT = 0; } }
        else u.stuckT = 0;
        car.drive(dt, throttle, steer, Math.abs(diff) > 1.1 && car.speed > 14, ctx.particles, null);
        car.collideWorld(city, ctx.particles, sound);
        if (player.car) {
          const impact = car.collideCar(player.car, ctx.particles, sound);
          if (impact > 9) ctx.onPlayerRam(impact);
        }
        // officer steps out when the player is on foot or crawling
        if (d < 15 && (!player.car || Math.abs(player.car.speed) < 2.5)) {
          u.mode = 'foot';
          u.officer = new Ped(this.scene, this.rng, car.x + 1.6, car.z, { uniform: true, gun: true, health: 45, hostile: true });
          car.parked = true;
        }
      } else if (u.officer) {
        const o = u.officer;
        if (player.car && Math.abs(player.car.speed) > 6 && d > 30) {
          o.dispose(this.scene); u.officer = null; u.mode = 'car'; car.parked = false;
        } else {
          // chase on foot; shoot in bursts when in range
          const od = Math.hypot(o.x - player.x, o.z - player.z);
          o.target = od > 9 ? { x: player.x, z: player.z } : null;
          o.idleT = 0; o.state = 'walk';
          if (od <= 9) { o.mesh.rotation.y = Math.atan2(player.x - o.x, player.z - o.z); o.mesh.position.set(o.x, 0, o.z); }
          else o.update(dt, ctx);
          o.shootCd -= dt;
          if (od < 30 && o.shootCd <= 0) {
            o.shootCd = this.rng.range(0.55, 1.1);
            ctx.onOfficerShoot(o);
          }
          if (o.dead) { u.officer = null; u.mode = 'car'; car.parked = false; wanted.crime(60, ctx); }
        }
      }
      car.setNightLights(ctx.nightFactor > 0.4, false);
    }
    if (sound) sound.setSiren(clamp(1.2 - nearest / 55, 0, 1), dt);
    // is the player seen? (any unit close with rough line of sight)
    ctx.playerSeen = nearest < 60;
  }
  allCars() { return [...this.units.map(u => u.car), ...this.blocks]; }
  officers() { return this.units.map(u => u.officer).filter(Boolean); }
}
