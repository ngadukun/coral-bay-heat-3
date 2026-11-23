// main.js — boot, the game loop, camera work, HUD wiring, car entry, the
// busted/wasted rules and the menu/pause flow for Coral Bay Heat.
import { makeRng, clamp, fmtCash, fmtTime } from './rng.js';
import { City, LOCATIONS } from './city.js';
import { Sky } from './sky.js';
import { Particles } from './particles.js';
import { Sound } from './sound.js';
import { Input } from './input.js';
import { Traffic } from './traffic.js';
import { Crowd } from './pedestrians.js';
import { Police, Wanted } from './police.js';
import { Player } from './player.js';
import { Minimap } from './minimap.js';
import { Missions } from './missions.js';
import { stageShot } from './shots.js';
import { loadSave, storeSave, clearSave, defaultSave, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10);
const shotName = params.get('shot');

const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.className = 'webgl';
container.appendChild(renderer.domElement);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1600);
camera.position.set(-160, 30, 260);

const rng = makeRng(seed * 1000 + 17);
const city = new City(scene, rng);
const sky = new Sky(scene, rng);
const particles = new Particles(scene);
const sound = new Sound();
const input = new Input(renderer.domElement);
const traffic = new Traffic(scene, rng, city);
const crowd = new Crowd(scene, rng);
const police = new Police(scene, rng);
const wanted = new Wanted();
let saveState = defaultSave();
const player = new Player(scene, rng, LOCATIONS.start.x, LOCATIONS.start.z);
const missions = new Missions();
const minimap = new Minimap(document.getElementById('minimap'));

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = {
  dialogueOpen: false, cardOpen: false, toastT: null,
  setObjective(t) { $('objective').textContent = t || ''; $('objective').style.display = t ? '' : 'none'; },
  setTimer(s) { $('timer').textContent = s > 0 ? fmtTime(s) : ''; },
  setPrompt(t) { $('prompt').textContent = t || ''; $('prompt').style.display = t ? '' : 'none'; },
  toast(t) {
    const el = $('toast'); el.textContent = t; el.style.opacity = 1;
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.style.opacity = 0; }, 2600);
  },
  showDialogue(who, text) {
    this.dialogueOpen = true;
    $('dialogue').classList.remove('hidden');
    $('dlg-who').textContent = who; $('dlg-text').textContent = text;
    const av = $('dlg-avatar');
    av.textContent = who.split(' ').map(w => w[0]).join('').slice(0, 2);
    av.style.background = who.includes('Rosa') ? '#ffb3a0' : who.includes('Valen') ? '#a8ecff' : '#ffd23c';
  },
  hideDialogue() { this.dialogueOpen = false; $('dialogue').classList.add('hidden'); },
  showCard(title, body, btn = 'Continue') {
    this.cardOpen = true;
    $('card-title').textContent = title; $('card-body').textContent = body; $('card-btn').textContent = btn;
    $('card').classList.remove('hidden');
  },
  hideCard() { this.cardOpen = false; $('card').classList.add('hidden'); },
  bigmsg(t, color) {
    const el = $('bigmsg'); el.textContent = t; el.style.color = color;
    el.classList.toggle('hidden', !t);
  },
};
$('card-btn').addEventListener('click', () => { ui.hideCard(); sound.click(); if (missions.failed) { missions.failed = false; } });

// ---------- shared context ----------
const ctx = {
  scene, rng, city, sky, particles, sound, input, traffic, crowd, police, wanted, player,
  missions, ui, saveState,
  extraCars: [], time: 0, nightFactor: 0, camYaw: 2.6, camPitch: 0.32, shake: 0,
  slowmoT: 0, playerSeen: false, aiming: false, shotCops: null, shotMarker: null,
  allCars() { return [...traffic.allVehicles(), ...police.allCars(), ...this.extraCars]; },
  saveGame() {
    saveState.pos = { x: Math.round(player.x), z: Math.round(player.z) };
    saveState.cash = Math.round(saveState.cash);
    saveState.ammo = player.ammo; saveState.pistol = player.pistol;
    storeSave(saveState);
  },
  onOfficerShoot(o) { shootAtPlayer(o, 0.34, 8); },
  onGunmanShoot(g) { shootAtPlayer(g, 0.3, 7); },
  onPlayerRam(impact) { ctx.shake = Math.min(0.7, ctx.shake + impact * 0.012); },
};
missions.bind(ctx);
function shootAtPlayer(shooter, hitChance, dmg) {
  sound.shot();
  particles.sparks(shooter.x, 1.4, shooter.z, 2);
  const d = Math.hypot(player.x - shooter.x, player.z - shooter.z);
  for (let i = 1; i <= 3; i++)
    particles.spawn(shooter.x + (player.x - shooter.x) * (i / 3), 1.35, shooter.z + (player.z - shooter.z) * (i / 3), 0, 0, 0, 0.06, 1, 0.8, 0.3, 0);
  if (Math.random() < hitChance * clamp(1.3 - d / 45, 0.3, 1)) {
    player.hurt(dmg * (0.7 + Math.random() * 0.6), ctx);
    ctx.shake = Math.min(0.6, ctx.shake + 0.15);
  }
  crowd.panicAt(shooter.x, shooter.z, 20);
}

// restore collectible state from the save into the world
function applySaveToWorld() {
  for (const s of city.shells) if (saveState.shells.includes(s.id)) { s.taken = true; s.mesh.visible = false; }
  for (const b of city.buoys) if (saveState.buoys.includes(b.id)) { b.taken = true; b.mesh.visible = false; }
  player.pistol = !!saveState.pistol; player.ammo = saveState.ammo || 0;
}

// ---------- game state ----------
let mode = shotName ? 'shot' : 'menu';
let shotCam = null;
let bustedMeter = 0, crimeCd = 0, menuAngle = 0;
let prevMouseDown = false;

if (shotName) {
  $('start-screen').classList.add('hidden');
  saveState.cash = 2450; saveState.shells = [0, 1, 2]; saveState.buoys = [0, 1];
  player.pistol = true; player.ammo = 18;
  shotCam = stageShot(shotName, ctx);
  ui.setObjective(document.querySelector('#objective').textContent || '');
} else {
  $('btn-continue').style.display = hasSave() ? '' : 'none';
}
function startPlay(fresh) {
  if (fresh) { clearSave(); saveState = defaultSave(); ctx.saveState = saveState; missions.bind(ctx); }
  else { const s = loadSave(); if (s) { saveState = s; ctx.saveState = saveState; missions.bind(ctx); } }
  applySaveToWorld();
  player.x = saveState.pos.x; player.z = saveState.pos.z;
  player.healFull();
  $('start-screen').classList.add('hidden');
  mode = 'play'; input.wantLock = true;
  sound.init();
  ui.setObjective(saveState.missionIndex < 13 ? 'Next job: find your contact — follow the gold marker' : 'Free roam — Coral Bay is yours');
  ui.toast(saveState.started ? 'Welcome back, Mari' : 'Welcome home, Mari');
  saveState.started = true; ctx.saveGame();
}
$('btn-new').addEventListener('click', () => startPlay(true));
$('btn-continue').addEventListener('click', () => startPlay(false));
$('btn-resume').addEventListener('click', () => { $('pause-screen').classList.add('hidden'); mode = 'play'; input.wantLock = true; });
$('btn-save').addEventListener('click', () => { ctx.saveGame(); ui.toast('Saved'); });
$('btn-restart').addEventListener('click', () => { clearSave(); location.reload(); });

function respawn(at, why) {
  const fine = Math.floor(saveState.cash * 0.12);
  saveState.cash -= fine;
  wanted.clear(); bustedMeter = 0;
  player.healFull(); player.car = null;
  player.x = at.x; player.z = at.z;
  ui.bigmsg('', '');
  ui.showCard(why, 'The city takes ' + fmtCash(fine) + ' for its trouble. You walk out with ' + fmtCash(saveState.cash) + '.', 'Walk out');
  ctx.saveGame();
}

// ---------- per-frame ----------
const clockT = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clockT.getDelta(), 0.05);
  if (ctx.slowmoT > 0) { ctx.slowmoT -= dt; dt *= 0.35; }
  ctx.time += dt;
  const focus = { x: player.x, z: player.z };
  sky.update(mode === 'shot' ? dt : dt, focus);
  ctx.nightFactor = sky.nightFactor;
  city.update(dt, ctx.time, sky.nightFactor);
  particles.update(dt);

  if (mode === 'menu') {
    menuAngle += dt * 0.05;
    camera.position.set(Math.cos(menuAngle) * 210, 60, Math.sin(menuAngle) * 210);
    camera.lookAt(0, 8, 60);
    renderer.render(scene, camera);
    return;
  }
  if (mode === 'shot') {
    sky.fireworksActive = shotName === 'finale' ? true : sky.fireworksActive;
    if (ctx.shotCops) for (const c of ctx.shotCops) { c.flashBar(ctx.time); c.setNightLights(true, false); }
    if (player.car) player.car.setNightLights(true, true);
    camera.position.set(shotCam.pos[0], shotCam.pos[1], shotCam.pos[2]);
    camera.lookAt(shotCam.target[0], shotCam.target[1], shotCam.target[2]);
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.angle;
    updateHUD();
    minimap.draw(ctx, ctx.shotMarker);
    renderer.render(scene, camera);
    return;
  }
  if (mode === 'pause' || ui.cardOpen) { renderer.render(scene, camera); input.endFrame(); return; }

  // ----- play -----
  crimeCd -= dt;
  const md = input.consumeMouse();
  if (input.locked) {
    ctx.camYaw -= md.x * 0.0026;
    ctx.camPitch = clamp(ctx.camPitch + md.y * 0.0022, -0.15, 1.05);
  }
  // dialogue advance / card by click
  const clicked = input.mouseDown && !prevMouseDown; prevMouseDown = input.mouseDown;
  if (clicked && ui.dialogueOpen) missions.tryInteract();

  // E interactions: dialogue/missions/shops first, then cars
  if (input.hit('KeyE')) {
    if (!missions.tryInteract()) {
      if (player.car) exitCar();
      else tryEnterCar();
    }
  }
  if (input.hit('Escape')) {
    $('pause-screen').classList.remove('hidden');
    $('pause-stats').textContent = 'Missions done: ' + saveState.missionIndex + '/13 · Shells: ' + saveState.shells.length + '/22 · Buoys: ' + saveState.buoys.length + '/14 · Cash earned: ' + fmtCash(saveState.totalEarned) + ' · Races won: ' + saveState.racesWon + ' · Fares: ' + saveState.faresDone;
    mode = 'pause'; input.wantLock = false;
    renderer.render(scene, camera); input.endFrame();
    return;
  }

  // driving or on foot
  if (player.car) {
    const car = player.car;
    const throttle = (input.down('KeyW') ? 1 : 0) + (input.down('KeyS') ? -1 : 0);
    const steer = (input.down('KeyA') ? 1 : 0) + (input.down('KeyD') ? -1 : 0);
    car.drive(dt, throttle, steer, input.down('Space'), particles, sound);
    car.collideWorld(city, particles, sound);
    for (const other of ctx.allCars()) {
      if (other === car) continue;
      if (Math.abs(other.x - car.x) < 7 && Math.abs(other.z - car.z) < 7) {
        const impact = car.collideCar(other, particles, sound);
        if (impact > 8 && crimeCd <= 0) { wanted.crime(other.type === 'cop' ? 45 : 16, ctx); crimeCd = 1.2; ctx.shake = Math.min(0.6, ctx.shake + 0.2); }
      }
    }
    for (const ped of crowd.peds) {
      if (!ped.dead && Math.abs(car.speed) > 7 && Math.hypot(ped.x - car.x, ped.z - car.z) < 1.9) {
        ped.hurt(30, particles); wanted.crime(50, ctx); sound.crash(0.3);
        ctx.shake = Math.min(0.7, ctx.shake + 0.25);
      }
    }
    // stunt ramps handled by missions; engine audio
    sound.setEngine(true, Math.abs(car.speed) / car.spec.topSpeed, true);
    car.setNightLights(ctx.nightFactor > 0.4, true);
  } else {
    sound.setEngine(false, 0, false);
    player.update(dt, ctx);
    if (clicked && !ui.dialogueOpen) {
      if (player.pistol && player.ammo > 0) player.tryShoot(ctx);
      else player.tryPunch(ctx);
    }
  }
  if (player.car) player.update(dt, ctx);

  traffic.update(dt, ctx);
  crowd.update(dt, ctx);
  police.update(dt, ctx);
  wanted.update(dt, ctx.playerSeen);
  missions.update(dt);

  // busted meter
  const nearCop = Math.min(
    ...police.allCars().map(c => Math.hypot(c.x - player.x, c.z - player.z)),
    ...police.officers().map(o => Math.hypot(o.x - player.x, o.z - player.z)),
    999,
  );
  const slowOrFoot = !player.car || Math.abs(player.car.speed) < 2.5;
  if (wanted.stars > 0 && nearCop < 8 && slowOrFoot) bustedMeter = Math.min(1, bustedMeter + dt / 2.4);
  else bustedMeter = Math.max(0, bustedMeter - dt * 0.7);
  $('busted-wrap').style.display = bustedMeter > 0.02 ? 'block' : 'none';
  $('busted-bar').style.width = (bustedMeter * 100) + '%';
  if (bustedMeter >= 1) { ui.bigmsg('BUSTED', '#7db4ff'); respawn(LOCATIONS.policeStation, 'Busted'); }
  if (player.dead) { ui.bigmsg('WASTED', '#ff5f6d'); respawn(LOCATIONS.hospital, 'Wasted'); }

  // ambient life: gulls near the shore, rain patter
  if (Math.random() < dt * 0.05 && Math.abs(player.z) > 200) sound.gull();
  if (sky.weather === 'rain' && Math.random() < dt * 0.5) sound.thunderlessRain(true);

  // prompt line
  ui.setPrompt(missions.promptText() || promptForCar());

  updateCamera(dt);
  updateHUD();
  minimap.draw(ctx, missions.marker());
  renderer.render(scene, camera);
  input.endFrame();
}

function promptForCar() {
  if (player.car) return 'E — Exit car · Space — Handbrake';
  let best = null, bd = 3.6;
  for (const c of ctx.allCars()) { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; best = c; } }
  if (best) return best.parked ? 'E — Enter car' : 'E — Jack car';
  return null;
}
function tryEnterCar() {
  let best = null, bd = 3.6;
  for (const c of ctx.allCars()) { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; best = c; } }
  if (!best) return;
  const wasTraffic = traffic.cars.includes(best);
  traffic.removeCar(best);
  if (!ctx.extraCars.includes(best) && !police.allCars().includes(best)) ctx.extraCars.push(best);
  if (wasTraffic) { wanted.crime(35, ctx); ui.toast('Car jacked — heat rising!'); }
  if (best.type === 'cop') wanted.crime(45, ctx);
  best.parked = false;
  player.car = best;
  sound.init(); sound.click();
}
function exitCar() {
  const car = player.car;
  player.car = null;
  player.x = car.x + Math.cos(car.angle) * 2.2;
  player.z = car.z - Math.sin(car.angle) * 2.2;
  const [cx, cz] = city.collide(player.x, player.z, 0.45);
  player.x = cx; player.z = cz;
  car.speed = 0;
  sound.click();
}
function updateCamera(dt) {
  ctx.shake = Math.max(0, ctx.shake - dt * 1.6);
  const shx = (Math.random() - 0.5) * ctx.shake, shy = (Math.random() - 0.5) * ctx.shake * 0.6;
  if (player.car) {
    const car = player.car;
    const back = 10.5, h = 3.4;
    const tx = car.x - Math.sin(car.angle) * back, tz = car.z - Math.cos(car.angle) * back;
    camera.position.lerp(new THREE.Vector3(tx, h + car.y, tz), 1 - Math.pow(0.0001, dt));
    const [cx, cz] = city.collide(camera.position.x, camera.position.z, 0.6);
    camera.position.x = cx; camera.position.z = cz;
    camera.lookAt(car.x + Math.sin(car.angle) * 6 + shx, 1.4 + shy, car.z + Math.cos(car.angle) * 6);
    ctx.camYaw = -car.angle + Math.PI;
  } else {
    const dist = 7.6;
    const cxp = player.x + Math.sin(ctx.camYaw) * Math.cos(ctx.camPitch) * dist;
    const czp = player.z + Math.cos(ctx.camYaw) * Math.cos(ctx.camPitch) * dist;
    const cyp = player.y + 1.7 + Math.sin(ctx.camPitch) * dist;
    camera.position.lerp(new THREE.Vector3(cxp, Math.max(0.7, cyp), czp), 1 - Math.pow(0.000001, dt));
    const [ccx, ccz] = city.collide(camera.position.x, camera.position.z, 0.5);
    camera.position.x = ccx; camera.position.z = ccz;
    camera.lookAt(player.x + shx, player.y + 1.55 + shy, player.z);
  }
}
function updateHUD() {
  $('health-bar').style.width = clamp(player.health, 0, 100) + '%';
  $('cash').textContent = fmtCash(saveState.cash);
  $('ammo').textContent = player.pistol ? '🔫 Pistol · ' + player.ammo + ' rounds' : (saveState.missionIndex >= 2 ? '' : 'Unarmed — fists only');
  $('collect').textContent = '🐚 ' + saveState.shells.length + '/22   🔆 ' + saveState.buoys.length + '/14';
  const stars = wanted.stars;
  let html = '';
  for (let i = 0; i < 5; i++) html += '<span class="' + (i < stars ? 'on' : '') + '">★</span>';
  $('stars').innerHTML = html;
  $('stars').style.opacity = (stars > 0 && !ctx.playerSeen && wanted.unseenT > 2) ? (0.45 + 0.4 * Math.sin(ctx.time * 6)) : 1;
  $('clock').textContent = sky.clockText();
  $('weather').textContent = sky.weather + (sky.wetness > 0.5 ? ' · wet roads' : '');
  document.getElementById('grade').style.opacity = 0.25 + sky.goldenFactor * 0.45;
}
frame();
