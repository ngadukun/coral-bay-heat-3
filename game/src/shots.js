// shots.js — deterministic staged scenes for the judged screenshots.
// Each scene fixes the clock, weather, cast and camera; the real game renders.
import { Car } from './vehicles.js';
import { LOCATIONS } from './city.js';

export function stageShot(name, ctx) {
  const { sky, player, wanted } = ctx;
  sky.setWeather('clear');
  ctx.shotMarker = null;
  if (name === 'cover') {
    sky.setTime(0.735); // golden hour over the marina
    player.x = 58; player.z = 250; player.angle = -2.4;
    const cabrio = new Car(ctx.scene, 'sports', 0x3e92cc, 34, 244, 1.15);
    ctx.extraCars.push(cabrio);
    ctx.ui.setObjective('Welcome home, Mari — Coral Bay is waiting');
    return { pos: [148, 6.5, 296], target: [26, 3, 222] };
  }
  if (name === 'chase') {
    sky.setTime(0.965); // neon night
    sky.setWeather('clear');
    const hero = new Car(ctx.scene, 'sports', 0xe2543e, 236.6, 26, Math.PI);
    hero.speed = 21;
    ctx.extraCars.push(hero);
    player.car = hero;
    const cop1 = new Car(ctx.scene, 'cop', 0xffffff, 236.6, 45, Math.PI); cop1.speed = 22;
    const cop2 = new Car(ctx.scene, 'cop', 0xffffff, 243.4, 60, Math.PI); cop2.speed = 22;
    const cop3 = new Car(ctx.scene, 'cop', 0xffffff, 243.4, 4, Math.PI); cop3.speed = 20;
    ctx.extraCars.push(cop1, cop2, cop3);
    ctx.shotCops = [cop1, cop2, cop3];
    const t1 = new Car(ctx.scene, 'sedan', 0xf2c14e, 243.4, -34, Math.PI);
    const t2 = new Car(ctx.scene, 'van', 0x7bd0a8, 243.4, -78, Math.PI);
    ctx.extraCars.push(t1, t2);
    wanted.heat = 350; // four stars
    ctx.ui.setObjective('Night Run — lose the heat on the coast road!');
    return { pos: [251, 4.4, 52], target: [233, 1.4, 6] };
  }
  if (name === 'port') {
    sky.setTime(0.66); // late-afternoon gold on the cranes
    player.x = 214; player.z = 0; player.angle = 2.6;
    const hot = new Car(ctx.scene, 'sports', 0xe2543e, 228, -18, 0.4);
    ctx.extraCars.push(hot);
    ctx.shotMarker = { x: 228, z: -18 };
    ctx.ui.setObjective('Hot Cargo — deliver the marked car to the Downtown Lockup');
    return { pos: [199, 5.5, 17], target: [231, 2.5, -27] };
  }
  // finale
  sky.setTime(0.755); // sunset sliding into night
  sky.fireworksActive = true;
  player.x = -20; player.z = 247; player.angle = 0.15;
  const parked = new Car(ctx.scene, 'sports', 0xf2c14e, -44, 240, 1.4);
  ctx.extraCars.push(parked);
  for (let i = 0; i < 4; i++) sky.launchFirework(0, 300);
  ctx.ui.setObjective('Fireworks Finale — the harbour is quiet again');
  return { pos: [-42, 3.4, 229], target: [18, 11, 296] };
}
export { LOCATIONS };
