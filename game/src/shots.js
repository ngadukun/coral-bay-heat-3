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
    player.x = 70; player.z = 250; player.angle = -2.4;
    const cabrio = new Car(ctx.scene, 'sports', 0x3e92cc, 46, 243, 1.15);
    ctx.extraCars.push(cabrio);
    ctx.ui.setObjective('Welcome home, Mari — Coral Bay is waiting');
    return { pos: [96, 6, 292], target: [30, 3, 236] };
  }
  if (name === 'chase') {
    sky.setTime(0.965); // neon night
    sky.setWeather('clear');
    const hero = new Car(ctx.scene, 'sports', 0xe2543e, 30, 236.6, Math.PI / 2);
    hero.speed = 21;
    ctx.extraCars.push(hero);
    player.car = hero;
    const cop1 = new Car(ctx.scene, 'cop', 0xffffff, 8, 236.6, Math.PI / 2); cop1.speed = 22;
    const cop2 = new Car(ctx.scene, 'cop', 0xffffff, 2, 243.4, Math.PI / 2); cop2.speed = 22;
    const cop3 = new Car(ctx.scene, 'cop', 0xffffff, 54, 243.4, Math.PI / 2); cop3.speed = 20;
    ctx.extraCars.push(cop1, cop2, cop3);
    ctx.shotCops = [cop1, cop2, cop3];
    const t1 = new Car(ctx.scene, 'sedan', 0xf2c14e, 78, 243.4, Math.PI / 2);
    const t2 = new Car(ctx.scene, 'van', 0x7bd0a8, 112, 243.4, Math.PI / 2);
    ctx.extraCars.push(t1, t2);
    wanted.heat = 350; // four stars
    ctx.ui.setObjective('Night Run — lose the heat on the coast road!');
    return { pos: [-8, 5.5, 253], target: [58, 1, 236.5] };
  }
  if (name === 'port') {
    sky.setTime(0.7); // late-afternoon gold on the cranes
    player.x = 203; player.z = -24; player.angle = 2.6;
    const hot = new Car(ctx.scene, 'sports', 0xe2543e, 211, -38, 2.2);
    ctx.extraCars.push(hot);
    ctx.shotMarker = { x: 211, z: -38 };
    ctx.ui.setObjective('Hot Cargo — deliver the marked car to the Downtown Lockup');
    return { pos: [183, 5, 0], target: [212, 2, -26] };
  }
  // finale
  sky.setTime(0.74); // sunset sliding into night
  sky.fireworksActive = true;
  player.x = -20; player.z = 247; player.angle = 0.15;
  const parked = new Car(ctx.scene, 'sports', 0xf2c14e, -44, 240, 1.4);
  ctx.extraCars.push(parked);
  for (let i = 0; i < 6; i++) sky.launchFirework(-10, 292);
  ctx.ui.setObjective('Fireworks Finale — the harbour is quiet again');
  return { pos: [-30, 2.6, 236], target: [25, 15, 296] };
}
export { LOCATIONS };
