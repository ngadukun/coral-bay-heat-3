// sky.js — day-night cycle (~6 min days), sun/moon, stars, clouds, weather
// (clear / overcast / rain with wet-looking roads) and nightly fireworks.
import { clamp, lerp } from './rng.js';

const DAY_LEN = 360; // seconds per full day
export class Sky {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.time = 0.32; // 0..1, 0.25 = dawn, 0.5 = noon, 0.78 = golden hour
    this.weather = 'clear'; this.weatherT = 40; this.wetness = 0;
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(120, 180, 60); scene.add(this.sun);
    this.amb = new THREE.AmbientLight(0xbcd6ff, 0.55); scene.add(this.amb);
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.5); scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xcfe8f5, 180, 720);
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(900, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x87c5e8, side: THREE.BackSide, fog: false }));
    scene.add(this.skyDome);
    // sun and moon billboards
    this.sunBall = new THREE.Mesh(new THREE.SphereGeometry(22, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
    this.moonBall = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }));
    scene.add(this.sunBall); scene.add(this.moonBall);
    // stars
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const a = rng.range(0, Math.PI * 2), e = rng.range(0.08, 1.4), r = 860;
      sp.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, fog: false, transparent: true, opacity: 0 }));
    scene.add(this.stars);
    // drifting clouds
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(9, 20), 8, 6), cloudMat);
        puff.position.set(k * 13 - 18, rng.range(-2, 2), rng.range(-6, 6)); puff.scale.y = 0.36; g.add(puff);
      }
      g.position.set(rng.range(-600, 600), rng.range(120, 190), rng.range(-600, 600));
      scene.add(g); this.clouds.push(g);
    }
    // rain streaks around a focus point (the camera target)
    const rainGeo = new THREE.BufferGeometry();
    this.rainPos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) this.rainPos.set([rng.range(-70, 70), rng.range(0, 55), rng.range(-70, 70)], i * 3);
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.32, transparent: true, opacity: 0 }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    // fireworks: pooled points launched over the marina at night
    this.fw = { parts: [], geo: new THREE.BufferGeometry(), timer: 3 };
    this.fwPos = new Float32Array(1200 * 3); this.fwCol = new Float32Array(1200 * 3);
    this.fw.geo.setAttribute('position', new THREE.BufferAttribute(this.fwPos, 3));
    this.fw.geo.setAttribute('color', new THREE.BufferAttribute(this.fwCol, 3));
    this.fwPoints = new THREE.Points(this.fw.geo, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
    this.fwPoints.frustumCulled = false; scene.add(this.fwPoints);
    this.fireworksActive = false;
    this.nightFactor = 0; this.goldenFactor = 0;
  }
  setTime(frac) { this.time = ((frac % 1) + 1) % 1; }
  setWeather(w) { this.weather = w; this.weatherT = this.rng.range(35, 80); }
  hourFloat() { return this.time * 24; }
  clockText() {
    const h = Math.floor(this.hourFloat()), m = Math.floor((this.hourFloat() - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  launchFirework(cx, cz) {
    const colors = [0xff5da2, 0x33e0ff, 0xffd23c, 0x9dff57, 0xff8c42, 0xc39bff];
    const c = new THREE.Color(this.rng.pick(colors));
    const ox = cx + this.rng.range(-50, 50), oz = cz + this.rng.range(-25, 25), oy = this.rng.range(46, 70);
    for (let i = 0; i < 70 && this.fw.parts.length < 1200; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = this.rng.range(9, 20);
      this.fw.parts.push({
        x: ox, y: oy, z: oz,
        vx: Math.cos(a) * Math.cos(e) * s, vy: Math.abs(Math.sin(e)) * s * 0.8 + 3, vz: Math.sin(a) * Math.cos(e) * s,
        life: this.rng.range(0.9, 1.7), r: c.r, g: c.g, b: c.b,
      });
    }
  }
  update(dt, focus) {
    this.time = (this.time + dt / DAY_LEN) % 1;
    const t = this.time;
    const sunAng = (t - 0.25) * Math.PI * 2; // dawn at .25
    const sunH = Math.sin(sunAng);
    const sx = Math.cos(sunAng) * 500, sy = sunH * 420, sz = 160;
    this.sunBall.position.set(sx, sy, sz);
    this.moonBall.position.set(-sx, -sy * 0.8 + 60, -sz);
    this.sun.position.set(sx * 0.4, Math.max(30, sy * 0.5), sz * 0.4);
    const dayF = clamp(sunH * 2.2 + 0.25, 0, 1);
    this.nightFactor = clamp(1 - dayF * 1.6, 0, 1);
    this.goldenFactor = clamp(1 - Math.abs(sunH) * 3.2, 0, 1) * (sunH > -0.12 ? 1 : 0);
    // sky colour: night -> dawn gold -> day blue -> dusk coral -> night
    const cNight = new THREE.Color(0x0d1830), cDay = new THREE.Color(0x87c5e8),
      cGold = new THREE.Color(0xff9e5e), cDusk = new THREE.Color(0xff7e5f);
    let sky = cNight.clone();
    if (sunH > 0.25) sky.lerp(cDay, clamp((sunH - 0.25) * 1.8, 0, 1));
    else if (sunH > -0.05) sky.lerp(sx > 0 ? cGold : cDusk, clamp((sunH + 0.05) * 3, 0, 1) * 0.9 + 0.1);
    if (this.weather === 'overcast') sky.lerp(new THREE.Color(0x8fa3b0), 0.55);
    if (this.weather === 'rain') sky.lerp(new THREE.Color(0x5d7182), 0.6);
    this.skyDome.material.color.copy(sky);
    this.scene.fog.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.25);
    this.scene.fog.far = this.weather === 'clear' ? 720 : 430;
    const warm = new THREE.Color(0xffb36b), noon = new THREE.Color(0xfff4e0), moon = new THREE.Color(0x8fb2e8);
    this.sun.color.copy(sunH > 0 ? noon.clone().lerp(warm, this.goldenFactor) : moon);
    this.sun.intensity = sunH > 0 ? lerp(0.35, 1.25, clamp(sunH * 1.6, 0, 1)) : 0.22;
    this.amb.intensity = lerp(0.16, 0.55, dayF);
    this.hemi.intensity = lerp(0.1, 0.5, dayF);
    this.stars.material.opacity = this.nightFactor * (this.weather === 'clear' ? 0.95 : 0.15);
    this.sunBall.material.color.setHex(sunH > -0.05 ? 0xfff3b0 : 0x554f33);
    // weather drift
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      const roll = this.rng.next();
      this.weather = roll < 0.55 ? 'clear' : roll < 0.8 ? 'overcast' : 'rain';
      this.weatherT = this.rng.range(35, 85);
    }
    this.wetness = clamp(this.wetness + (this.weather === 'rain' ? dt * 0.08 : -dt * 0.03), 0, 1);
    // clouds drift
    for (const c of this.clouds) {
      c.position.x += dt * (2 + this.wetness * 4);
      if (c.position.x > 650) c.position.x = -650;
      c.children.forEach(p => { p.material.opacity = this.weather === 'clear' ? 0.75 : 0.95; });
    }
    // rain around the focus
    const raining = this.weather === 'rain';
    this.rain.material.opacity = raining ? 0.65 : 0;
    if (raining && focus) {
      this.rain.position.set(focus.x, 0, focus.z);
      for (let i = 0; i < 900; i++) {
        this.rainPos[i * 3 + 1] -= dt * 46;
        if (this.rainPos[i * 3 + 1] < 0) this.rainPos[i * 3 + 1] = 55;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    // fireworks over the marina on clear nights (and always during the finale staging)
    const isNight = this.nightFactor > 0.55;
    this.fw.timer -= dt;
    if ((isNight && this.weather === 'clear' && this.fw.timer <= 0) || (this.fireworksActive && this.fw.timer <= 0)) {
      this.launchFirework(0, 300);
      this.fw.timer = this.rng.range(1.4, 3.4);
    }
    const parts = this.fw.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy -= dt * 4.5; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (let i = 0; i < 1200; i++) {
      const p = parts[i];
      if (p) { this.fwPos.set([p.x, p.y, p.z], i * 3); this.fwCol.set([p.r, p.g, p.b], i * 3); }
      else { this.fwPos.set([0, -100, 0], i * 3); this.fwCol.set([0, 0, 0], i * 3); }
    }
    this.fw.geo.attributes.position.needsUpdate = true;
    this.fw.geo.attributes.color.needsUpdate = true;
    return { dayF };
  }
}
