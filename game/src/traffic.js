// traffic.js — civilian cars that follow the road grid lanes, keep spacing,
// brake for lights and obstacles, honk when blocked and flee from gunfire.
import { ROADS, isRoad } from './city.js';
import { Car, CAR_COLORS } from './vehicles.js';
import { clamp, angleLerp } from './rng.js';

export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene; this.rng = rng; this.city = city;
    this.cars = []; this.parked = [];
    this.spawnInitial();
  }
  spawnInitial() {
    const rng = this.rng;
    const types = ['sedan', 'sedan', 'sedan', 'sports', 'van', 'truck', 'taxi'];
    for (let i = 0; i < 30; i++) {
      const axis = rng.chance(0.5) ? 'x' : 'z';
      const line = rng.pick(ROADS);
      const along = rng.range(-250, 250);
      const dir = rng.sign();
      const type = rng.pick(types);
      const x = axis === 'x' ? along : line - 3.4 * dir;
      const z = axis === 'x' ? line + 3.4 * dir : along;
      const car = new Car(this.scene, type, rng.pick(CAR_COLORS), x, z, 0);
      car.traffic = { axis, line, dir, cooldown: rng.range(0, 4), panicT: 0, honkT: rng.range(2, 9) };
      car.angle = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      this.cars.push(car);
    }
    // parked cars along kerbs, in the port and at the beach car park
    for (let i = 0; i < 34; i++) {
      const horiz = rng.chance(0.5), line = rng.pick(ROADS), s = rng.range(-252, 252), side = rng.sign();
      const x = horiz ? s : line + side * 10.5, z = horiz ? line + side * 10.5 : s;
      if (this.city.insideCollider(x, z, 2)) continue;
      const car = new Car(this.scene, rng.pick(['sedan', 'sedan', 'sports', 'van']), rng.pick(CAR_COLORS), x, z, horiz ? Math.PI / 2 : 0);
      car.parked = true;
      this.parked.push(car);
    }
  }
  allVehicles() { return [...this.cars, ...this.parked]; }
  panicAt(x, z, r = 40) {
    for (const c of this.cars) if (Math.hypot(c.x - x, c.z - z) < r) c.traffic.panicT = 3.5;
  }
  update(dt, ctx) {
    const { city, player, sound, particles, time } = ctx;
    for (const car of this.cars) {
      const tr = car.traffic;
      tr.cooldown -= dt; tr.panicT = Math.max(0, tr.panicT - dt);
      const axis = tr.axis, dir = tr.dir;
      const along = axis === 'x' ? car.x : car.z;
      const perp = axis === 'x' ? car.z : car.x;
      const perpTarget = axis === 'x' ? tr.line + 3.4 * dir : tr.line - 3.4 * dir;
      const err = perpTarget - perp;
      // desired velocity: along the road plus a lane-centring correction
      let vx = axis === 'x' ? dir : clamp(err * 0.14, -0.45, 0.45);
      let vz = axis === 'x' ? clamp(err * 0.14, -0.45, 0.45) : dir;
      if (tr.panicT > 0) { vx += Math.sin(time * 2.7 + car.id * 9) * 0.3; vz += Math.cos(time * 3.1 + car.id * 7) * 0.3; }
      const desired = Math.atan2(vx, vz);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 1.6, -1, 1);
      // target speed: cruise, slower in suburbs, flat out when panicking
      let target = tr.panicT > 0 ? car.spec.topSpeed * 0.95 : 13 + (car.id % 0.4) * 8;
      // obstacle scan: cars, the player's car, the player on foot
      let blocked = false;
      const f = car.forward();
      const probe = (ox, oz, rad) => {
        const rx = ox - car.x, rz = oz - car.z;
        const proj = rx * f.x + rz * f.z, lat = Math.abs(rx * f.z - rz * f.x);
        if (proj > 0 && proj < rad && lat < 2.3) blocked = true;
      };
      for (const o of this.cars) if (o !== car) probe(o.x, o.z, 10);
      if (player.car) probe(player.car.x, player.car.z, 10);
      else probe(player.x, player.z, 7);
      // red light at the next junction
      const phase = city.lightPhase(time);
      const greenForMe = (axis === 'x' && phase === 'ew') || (axis === 'z' && phase === 'ns');
      if (!greenForMe && tr.panicT <= 0) {
        for (const rc of ROADS) {
          const ahead = (rc - along) * dir;
          if (ahead > 2 && ahead < 8) { target = 0; break; }
        }
      }
      if (blocked) {
        target = 0;
        tr.honkT -= dt;
        if (tr.honkT <= 0 && sound && Math.abs(car.speed) < 1) { sound.horn(); tr.honkT = 2.5 + Math.random() * 4; }
      }
      let throttle = 0;
      if (car.speed < target - 0.5) throttle = 0.75;
      else if (car.speed > target + 2) throttle = car.speed > 1 ? -0.5 : 0;
      if (target === 0 && car.speed < 0.4) throttle = 0;
      car.drive(dt, throttle, steer, false, null, null);
      car.collideWorld(city, particles, sound);
      // turn at junctions
      if (tr.cooldown <= 0) {
        for (const rc of ROADS) {
          if (Math.abs(along - rc) < 2.2 && rc !== tr.line && this.rng.chance(0.4)) {
            tr.axis = axis === 'x' ? 'z' : 'x';
            tr.line = rc; tr.dir = this.rng.sign(); tr.cooldown = 5;
            break;
          }
        }
      }
      car.setNightLights(ctx.nightFactor > 0.4, false);
    }
  }
  removeCar(car) {
    this.cars = this.cars.filter(c => c !== car);
    this.parked = this.parked.filter(c => c !== car);
  }
}
export { isRoad };
