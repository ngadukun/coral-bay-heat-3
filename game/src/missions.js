// missions.js — the story mission runner plus free-roam side work: taxi
// fares, two street races, stunt jumps, the gun shop corner and collectibles.
import { MISSIONS } from './missions-data.js';
import { LOCATIONS } from './city.js';
import { Car } from './vehicles.js';
import { Ped } from './pedestrians.js';
import { clamp, fmtCash } from './rng.js';

const GIVERS = { 'Aunt Rosa': LOCATIONS.cafe, 'Valen Cruz': LOCATIONS.marinaPier };
const RACES = [
  { name: 'Downtown Dash', start: { x: 0, z: -52 }, pts: [[120, -60], [180, 0], [120, 120], [0, 60], [-120, 0], [0, -52]], par: 95, reward: 350 },
  { name: 'Coast Run', start: { x: 232, z: 0 }, pts: [[240, 180], [120, 240], [-60, 240], [-200, 120], [-240, -60], [-120, -200], [60, -240], [232, -120]], par: 150, reward: 500 },
];

export class Missions {
  constructor() {
    this.ctx = null;
    this.active = -1; this.stepIdx = 0; this.step = null;
    this.missionCar = null; this.followCar = null; this.followT = 0; this.spookT = 0; this.lostT = 0; this.wpIdx = 0;
    this.fightPeds = []; this.defendWave = 0; this.defendAlive = 0;
    this.ptsIdx = 0; this.timer = -1; this.buoyStart = 0;
    this.failed = false; this.failMsg = '';
    this.taxi = null; this.race = null; this.stuntAir = 0; this.stuntArmed = false;
    this.promptActive = false;
  }
  bind(ctx) { this.ctx = ctx; }
  get save() { return this.ctx.saveState; }
  currentMission() { return this.active >= 0 ? MISSIONS[this.active] : null; }
  marker() {
    const ctx = this.ctx;
    if (this.taxi) return this.taxi.stage === 'pickup' ? { x: this.taxi.ped.x, z: this.taxi.ped.z } : this.taxi.dest;
    if (this.race) return this.race.pts[this.race.idx];
    if (!this.step) {
      if (this.active < 0 && this.save.missionIndex < MISSIONS.length) {
        const g = GIVERS[MISSIONS[this.save.missionIndex].giver];
        return { x: g.x, z: g.z };
      }
      return null;
    }
    const s = this.step;
    if (s.k === 'goto') return { x: s.x, z: s.z };
    if (s.k === 'points') return { x: s.pts[this.ptsIdx][0], z: s.pts[this.ptsIdx][1] };
    if (s.k === 'follow' && this.followCar) return { x: this.followCar.x, z: this.followCar.z };
    if (s.k === 'fight' || s.k === 'defend') return { x: s.x, z: s.z };
    if (s.k === 'buoys') {
      const b = ctx.city.buoys.find(b => !b.taken);
      return b ? { x: b.x, z: b.z } : null;
    }
    return null;
  }
  startMission(i) {
    const ctx = this.ctx, m = MISSIONS[i];
    this.active = i; this.failed = false;
    if (m.timeOfDay !== undefined) ctx.sky.setTime(m.timeOfDay);
    if (m.pistol && !ctx.player.pistol) { ctx.player.pistol = true; ctx.player.ammo += 30; this.save.pistol = true; this.save.ammo = ctx.player.ammo; ctx.ui.toast('Pistol acquired — click to fire'); }
    ctx.ui.showCard(m.title, 'A job from ' + m.giver + ' — reward ' + fmtCash(m.reward), 'Start');
    this.setStep(0);
    ctx.sound.chime();
  }
  setStep(idx) {
    const ctx = this.ctx, m = this.currentMission();
    this.cleanupStep();
    this.stepIdx = idx;
    if (!m || idx >= m.steps.length) { this.completeMission(); return; }
    const s = m.steps[idx]; this.step = s;
    this.timer = s.time || -1; this.ptsIdx = 0; this.followT = 0; this.spookT = 0; this.lostT = 0; this.wpIdx = 0;
    ctx.wanted.setForced(s.wanted || 0);
    if (s.spawnCar && !this.missionCar) {
      this.missionCar = new Car(ctx.scene, s.spawnCar.type, s.spawnCar.color, s.spawnCar.x, s.spawnCar.z, s.spawnCar.angle || 0);
      ctx.extraCars.push(this.missionCar);
    }
    if (s.k === 'talk') ctx.ui.showDialogue(s.who, s.text);
    if (s.k === 'follow') {
      const start = s.spawnAt || s.route[0];
      this.followCar = new Car(ctx.scene, 'sedan', 0x8a93a0, start[0], start[1], 0);
      ctx.extraCars.push(this.followCar);
    }
    if (s.k === 'fight') this.spawnFight(s.x, s.z, s.n);
    if (s.k === 'defend') { this.defendWave = 0; this.spawnWave(s); }
    if (s.k === 'buoys') this.buoyStart = this.save.buoys.length;
    ctx.ui.setObjective(s.obj || (s.k === 'talk' ? 'Talk — press E to continue' : ''));
  }
  cleanupStep() {
    for (const p of this.fightPeds) p.dispose(this.ctx.scene);
    this.fightPeds = [];
    if (this.followCar) { this.ctx.scene.remove(this.followCar.mesh); this.ctx.extraCars = this.ctx.extraCars.filter(c => c !== this.followCar); this.followCar = null; }
  }
  spawnFight(x, z, n) {
    const ctx = this.ctx;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new Ped(ctx.scene, ctx.rng, x + Math.cos(a) * 9, z + Math.sin(a) * 9, { gun: true, hostile: true, health: 40, shirt: 0x22242a });
      this.fightPeds.push(p);
    }
  }
  spawnWave(s) {
    this.defendWave++;
    const n = 1 + this.defendWave;
    const ctx = this.ctx;
    for (let i = 0; i < n; i++) {
      const p = new Ped(ctx.scene, ctx.rng, s.x + ctx.rng.range(-26, 26), s.z + 18 + ctx.rng.range(-6, 10), { gun: true, hostile: true, health: 40, shirt: 0x4a2430 });
      this.fightPeds.push(p);
    }
    this.defendAlive = n;
    ctx.ui.toast('Wave ' + this.defendWave + ' of ' + s.waves + ' — hold the café!');
  }
  completeMission() {
    const ctx = this.ctx, m = this.currentMission();
    if (!m) { this.active = -1; this.step = null; return; }
    this.cleanupStep();
    ctx.wanted.setForced(0);
    this.save.cash += m.reward; this.save.totalEarned += m.reward;
    this.save.missionIndex = Math.max(this.save.missionIndex, this.active + 1);
    ctx.player.pistol = this.save.pistol; ctx.sound.chime();
    ctx.ui.showCard('Mission Complete', m.title + ' — ' + fmtCash(m.reward) + ' banked. Debt remaining shrinks…', 'Continue');
    ctx.ui.setObjective(this.save.missionIndex < MISSIONS.length ? 'Next job: ' + MISSIONS[this.save.missionIndex].title : 'Coral Bay is yours — free roam!');
    this.active = -1; this.step = null;
    ctx.saveGame();
  }
  failMission(msg) {
    const ctx = this.ctx;
    this.cleanupStep();
    ctx.wanted.setForced(0); ctx.wanted.heat = Math.min(ctx.wanted.heat, 90);
    this.failed = true; this.failMsg = msg;
    ctx.sound.fail();
    ctx.ui.showCard('Mission Failed', msg, 'Retry');
    this.active = -1; this.step = null;
  }
  // E-key contexts handled here before car entry: dialogue, mission start, gun shop.
  tryInteract() {
    const ctx = this.ctx, p = ctx.player;
    if (ctx.ui.dialogueOpen) {
      if (this.step && this.step.k === 'talk') { ctx.ui.hideDialogue(); this.setStep(this.stepIdx + 1); return true; }
      ctx.ui.hideDialogue(); return true;
    }
    if (this.active < 0 && !p.car && this.save.missionIndex < MISSIONS.length) {
      const g = GIVERS[MISSIONS[this.save.missionIndex].giver];
      if (Math.hypot(p.x - g.x, p.z - g.z) < 7) { this.startMission(this.save.missionIndex); return true; }
    }
    if (!p.car && Math.hypot(p.x - LOCATIONS.gunCorner.x, p.z - LOCATIONS.gunCorner.z) < 5.5) {
      if (!p.pistol) {
        if (this.save.cash >= 300) { this.save.cash -= 300; p.pistol = true; p.ammo += 24; this.save.pistol = true; ctx.ui.toast('Pistol bought — $300'); ctx.sound.chime(); }
        else ctx.ui.toast('Pistol costs $300 — you are short');
      } else if (this.save.cash >= 50) { this.save.cash -= 50; p.ammo += 24; ctx.ui.toast('Ammo +24 — $50'); ctx.sound.pickup(); }
      else ctx.ui.toast('Ammo costs $50 — you are short');
      this.save.ammo = p.ammo; ctx.saveGame();
      return true;
    }
    return false;
  }
  promptText() {
    const ctx = this.ctx, p = ctx.player;
    this.promptActive = false;
    if (ctx.ui.dialogueOpen) { this.promptActive = true; return 'E — Continue'; }
    if (this.failed) return null;
    if (this.active < 0 && !p.car && this.save.missionIndex < MISSIONS.length) {
      const g = GIVERS[MISSIONS[this.save.missionIndex].giver];
      if (Math.hypot(p.x - g.x, p.z - g.z) < 7) { this.promptActive = true; return 'E — Start: ' + MISSIONS[this.save.missionIndex].title; }
    }
    if (!p.car && Math.hypot(p.x - LOCATIONS.gunCorner.x, p.z - LOCATIONS.gunCorner.z) < 5.5) {
      this.promptActive = true;
      return p.pistol ? 'E — Buy ammo ($50)' : 'E — Buy pistol ($300)';
    }
    if (p.car && this.active < 0 && !this.taxi && !this.race) {
      if (p.car.type === 'taxi') { this.promptActive = true; return 'T — Take a taxi fare'; }
      for (const r of RACES) if (Math.hypot(p.x - r.start.x, p.z - r.start.z) < 9) { this.promptActive = true; return 'T — Start race: ' + r.name; }
    }
    if (this.taxi && this.taxi.stage === 'pickup' && p.car) return 'Pick up the passenger';
    return null;
  }
  update(dt) {
    const ctx = this.ctx, p = ctx.player;
    this.updateCollectibles();
    this.updateStunts(dt);
    // side activity hotkey
    if (ctx.input.hit('KeyT') && p.car && this.active < 0) {
      if (!this.taxi && !this.race && p.car.type === 'taxi') this.startFare();
      else if (!this.taxi && !this.race) for (const r of RACES) if (Math.hypot(p.x - r.start.x, p.z - r.start.z) < 9) this.startRace(r);
    }
    if (this.taxi) this.updateTaxi(dt);
    if (this.race) this.updateRace(dt);
    if (!this.step) return;
    const s = this.step;
    if (this.timer > 0) {
      this.timer -= dt;
      ctx.ui.setTimer(this.timer);
      if (this.timer <= 0) { ctx.ui.setTimer(-1); return this.failMission('Out of time. The job is blown.'); }
    } else ctx.ui.setTimer(-1);
    switch (s.k) {
      case 'talk': break; // advanced via tryInteract
      case 'goto': {
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        const okVeh = s.inMissionCar ? p.car === this.missionCar : s.inCar ? !!p.car : true;
        if (d < (s.r || 9) && okVeh) this.setStep(this.stepIdx + 1);
        break;
      }
      case 'points': {
        const [tx, tz] = s.pts[this.ptsIdx];
        ctx.ui.setObjective(s.obj + '  (' + (this.ptsIdx + 1) + '/' + s.pts.length + ')');
        if (Math.hypot(p.x - tx, p.z - tz) < 9) {
          ctx.sound.pickup(); ctx.particles.burst(tx, 2, tz, 14, 0xffd23c, 4, 0.7, 3);
          this.ptsIdx++;
          if (this.ptsIdx >= s.pts.length) this.setStep(this.stepIdx + 1);
        }
        break;
      }
      case 'follow': this.updateFollow(dt, s); break;
      case 'fight': case 'defend': this.updateFight(dt, s); break;
      case 'buoys': {
        const got = this.save.buoys.length - this.buoyStart;
        ctx.ui.setObjective(s.obj + '  (' + got + '/' + s.n + ')');
        if (got >= s.n) this.setStep(this.stepIdx + 1);
        break;
      }
    }
  }
  updateFollow(dt, s) {
    const ctx = this.ctx, p = ctx.player, car = this.followCar;
    if (!car) return;
    const [tx, tz] = s.route[this.wpIdx % s.route.length];
    const d = Math.hypot(car.x - tx, car.z - tz);
    if (d < 7) this.wpIdx++;
    const desired = Math.atan2(tx - car.x, tz - car.z);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.drive(dt, car.speed < 11 ? 0.7 : 0, clamp(diff * 1.6, -1, 1), false, null, null);
    car.collideWorld(ctx.city, null, null);
    const pd = Math.hypot(p.x - car.x, p.z - car.z);
    if (pd >= 13 && pd <= 55) { this.followT += dt; this.spookT = Math.max(0, this.spookT - dt); this.lostT = Math.max(0, this.lostT - dt); }
    else if (pd < 8) this.spookT += dt;
    else if (pd > 70) this.lostT += dt;
    ctx.ui.setObjective(s.obj + '  (' + Math.floor(this.followT) + '/' + s.dur + 's)');
    if (this.spookT > 3) return this.failMission('You spooked the target — the deal is off.');
    if (this.lostT > 5) return this.failMission('You lost the target in traffic.');
    if (this.followT >= s.dur) this.setStep(this.stepIdx + 1);
  }
  updateFight(dt, s) {
    const ctx = this.ctx, p = ctx.player;
    let alive = 0;
    for (const g of this.fightPeds) {
      if (g.dead) continue;
      alive++;
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      g.target = d > 15 ? { x: p.x, z: p.z } : null;
      g.idleT = 0;
      if (d <= 15) {
        // strafe sideways and hold position, firing in bursts
        g.x += Math.cos(g.angle) * g.strafeDir * dt * 1.1;
        g.z += -Math.sin(g.angle) * g.strafeDir * dt * 1.1;
        if (Math.random() < dt * 0.2) g.strafeDir *= -1;
        g.mesh.position.set(g.x, 0, g.z);
        g.mesh.rotation.y = Math.atan2(p.x - g.x, p.z - g.z);
      } else g.update(dt, ctx);
      g.shootCd -= dt;
      if (d < 30 && g.shootCd <= 0) { g.shootCd = ctx.rng.range(0.6, 1.2); ctx.onGunmanShoot(g); }
    }
    if (s.k === 'fight') {
      ctx.ui.setObjective(s.obj + '  (' + alive + ' left)');
      if (alive === 0) this.setStep(this.stepIdx + 1);
    } else {
      ctx.ui.setObjective(s.obj + ' — wave ' + this.defendWave + '/' + s.waves + ', ' + alive + ' attackers left');
      if (alive === 0) {
        if (this.defendWave >= s.waves) this.setStep(this.stepIdx + 1);
        else this.spawnWave(s);
      }
    }
  }
  startFare() {
    const ctx = this.ctx, p = ctx.player;
    const ped = new Ped(ctx.scene, ctx.rng, clamp(p.x + ctx.rng.range(-90, 90), -250, 250), clamp(p.z + ctx.rng.range(-90, 90), -250, 250));
    ped.target = null; ped.idleT = 9999;
    const dest = { x: ctx.rng.range(-220, 220), z: ctx.rng.range(-220, 220) };
    const dist = Math.hypot(dest.x - ped.x, dest.z - ped.z);
    this.taxi = { ped, dest, stage: 'pickup', timer: 40 + dist * 0.55, fare: Math.round(30 + dist * 0.45) };
    ctx.ui.setObjective('Taxi: pick up the passenger');
    ctx.ui.toast('Fare started — pick up your passenger');
  }
  updateTaxi(dt) {
    const ctx = this.ctx, p = ctx.player, t = this.taxi;
    t.timer -= dt;
    ctx.ui.setTimer(t.timer);
    if (t.timer <= 0) { ctx.ui.setTimer(-1); t.ped.dispose(ctx.scene); this.taxi = null; ctx.ui.toast('Fare lost — too slow'); ctx.ui.setObjective(''); return; }
    if (t.stage === 'pickup') {
      if (p.car && Math.hypot(p.x - t.ped.x, p.z - t.ped.z) < 6 && Math.abs(p.car.speed) < 2) {
        t.stage = 'dropoff'; t.ped.mesh.visible = false;
        ctx.ui.setObjective('Taxi: drop off at the gold marker — ' + fmtCash(t.fare));
        ctx.sound.pickup();
      }
    } else if (Math.hypot(p.x - t.dest.x, p.z - t.dest.z) < 9 && p.car && Math.abs(p.car.speed) < 3) {
      this.save.cash += t.fare; this.save.totalEarned += t.fare; this.save.faresDone++;
      ctx.ui.setTimer(-1); ctx.ui.toast('Fare paid: ' + fmtCash(t.fare)); ctx.sound.chime();
      t.ped.dispose(ctx.scene); this.taxi = null; ctx.ui.setObjective('');
      ctx.saveGame();
    }
  }
  startRace(def) {
    this.race = { def, pts: def.pts, idx: 0, timer: def.par };
    this.ctx.ui.setObjective('Race: ' + def.name + ' — checkpoint 1/' + def.pts.length);
    this.ctx.ui.toast(def.name + ' — GO!');
    this.ctx.sound.chime();
  }
  updateRace(dt) {
    const ctx = this.ctx, p = ctx.player, r = this.race;
    r.timer -= dt; ctx.ui.setTimer(r.timer);
    if (r.timer <= 0) { ctx.ui.setTimer(-1); this.race = null; ctx.ui.toast('Race lost — beat ' + r.def.par + 's next time'); ctx.ui.setObjective(''); return; }
    const [tx, tz] = r.pts[r.idx];
    ctx.ui.setObjective('Race: ' + r.def.name + ' — checkpoint ' + (r.idx + 1) + '/' + r.pts.length);
    if (Math.hypot(p.x - tx, p.z - tz) < 11) {
      ctx.sound.pickup(); ctx.particles.burst(tx, 2, tz, 16, 0x33e0ff, 5, 0.7, 3);
      r.idx++;
      if (r.idx >= r.pts.length) {
        this.save.cash += r.def.reward; this.save.totalEarned += r.def.reward; this.save.racesWon++;
        ctx.ui.setTimer(-1); ctx.ui.toast('Race won! ' + fmtCash(r.def.reward)); ctx.sound.chime();
        this.race = null; ctx.ui.setObjective(''); ctx.saveGame();
      }
    }
  }
  updateStunts(dt) {
    const ctx = this.ctx, car = ctx.player.car;
    if (!car) { this.stuntArmed = false; return; }
    for (const ramp of ctx.city.ramps || []) {
      if (car.airborne <= 0 && Math.hypot(car.x - ramp.x, car.z - ramp.z) < ramp.r && Math.abs(car.speed) > 14) {
        car.airborne = 0.95; car.vy = 9; this.stuntArmed = true; this.stuntAir = 0;
        ctx.sound.blip(300, 0.3, 'sine', 0.1, 500);
      }
    }
    if (car.airborne > 0) this.stuntAir += dt;
    else if (this.stuntArmed) {
      this.stuntArmed = false;
      if (this.stuntAir > 0.5) {
        this.save.cash += 150; this.save.totalEarned += 150;
        ctx.ui.toast('STUNT BONUS +$150'); ctx.sound.chime();
        ctx.slowmoT = 0.7; ctx.saveGame();
      }
      this.stuntAir = 0;
    }
  }
  updateCollectibles() {
    const ctx = this.ctx, p = ctx.player;
    for (const s of ctx.city.shells) {
      if (!s.taken && Math.hypot(p.x - s.x, p.z - s.z) < 2.6 && !p.car) {
        s.taken = true; s.mesh.visible = false;
        this.save.shells.push(s.id);
        ctx.sound.pickup(); ctx.particles.burst(s.x, 1, s.z, 10, 0xffc93c, 3, 0.6, 2);
        if (this.save.shells.length % 5 === 0) { this.save.cash += 250; ctx.ui.toast('Shells ' + this.save.shells.length + '/22 — bonus $250!'); }
        else ctx.ui.toast('Golden shell ' + this.save.shells.length + '/22');
        ctx.saveGame();
      }
    }
    for (const b of ctx.city.buoys) {
      if (!b.taken && Math.hypot(p.x - b.x, p.z - b.z) < 11) {
        b.taken = true; b.mesh.visible = false;
        this.save.buoys.push(b.id);
        ctx.sound.pickup(); ctx.particles.spray(b.x, 1, b.z, 14);
        if (this.save.buoys.length % 3 === 0) { this.save.cash += 200; ctx.ui.toast('Buoys ' + this.save.buoys.length + '/14 — bonus $200!'); }
        else ctx.ui.toast('Neon buoy ' + this.save.buoys.length + '/14');
        ctx.saveGame();
      }
    }
  }
}
export { MISSIONS };
