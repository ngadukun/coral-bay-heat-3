// particles.js — pooled point particles: sparks, smoke, dust, spray, confetti.
import { clamp } from './rng.js';
export class Particles {
  constructor(scene, max = 1500) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.size = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }
  spawn(x, y, z, vx, vy, vz, life, r, g, b, grav = -2) {
    const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.col.set([r, g, b], i * 3);
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }
  burst(x, y, z, count, color, speed = 5, life = 0.6, up = 2, grav = -3) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, z, Math.cos(a) * s, up * Math.random(), Math.sin(a) * s,
        life * (0.5 + Math.random() * 0.8), c.r, c.g, c.b, grav);
    }
  }
  sparks(x, y, z, n = 10) { this.burst(x, y, z, n, 0xffc266, 6, 0.4, 3, -6); }
  smoke(x, y, z, n = 6) { this.burst(x, y, z, n, 0x555560, 1.2, 1.4, 2.4, 1.5); }
  dust(x, y, z, n = 6) { this.burst(x, y, z, n, 0xcbb28a, 2, 0.7, 1, -0.5); }
  spray(x, y, z, n = 8) { this.burst(x, y, z, n, 0xbfeaff, 3, 0.6, 3.5, -7); }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] += this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.05) { this.pos[j + 1] = 0.05; this.vel[j + 1] = 0; }
      if (this.life[i] <= 0) { this.pos[j + 1] = -50; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.mat.opacity = 0.95;
  }
  setSize(s) { this.mat.size = clamp(s, 0.2, 1.4); }
}
