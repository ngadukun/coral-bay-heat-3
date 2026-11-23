// minimap.js — live corner map: roads, sea, player arrow, traffic dots,
// flashing police, gold mission markers and the collectible counter ring.
import { ROADS, ISLAND } from './city.js';

export class Minimap {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.t = 0;
  }
  draw(ctx, marker) {
    const g = this.g, S = this.cv.width, half = S / 2;
    const player = ctx.player;
    const zoom = player.car ? 0.62 : 0.85; // world units -> px scale denominator
    const scale = half / (ISLAND * zoom);
    const px = (wx) => half + (wx - player.x) * scale;
    const pz = (wz) => half + (wz - player.z) * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#175d7a'; g.fillRect(0, 0, S, S);
    // island
    g.fillStyle = '#cbb98d';
    g.fillRect(px(-ISLAND), pz(-ISLAND), ISLAND * 2 * scale, ISLAND * 2 * scale);
    // blocks tint
    g.fillStyle = '#a8b39a';
    g.fillRect(px(-268), pz(-268), 536 * scale, 536 * scale);
    // roads
    g.strokeStyle = '#3c3f45'; g.lineWidth = Math.max(2, 15 * scale);
    g.beginPath();
    for (const r of ROADS) {
      g.moveTo(px(-268), pz(r)); g.lineTo(px(268), pz(r));
      g.moveTo(px(r), pz(-268)); g.lineTo(px(r), pz(268));
    }
    g.stroke();
    // traffic as pale dots
    g.fillStyle = '#e8e4da';
    for (const c of ctx.traffic.cars) { g.beginPath(); g.arc(px(c.x), pz(c.z), 2, 0, 7); g.fill(); }
    // police flashing blue/red
    const flash = Math.sin(performance.now() * 0.012) > 0;
    for (const c of ctx.police.allCars()) {
      g.fillStyle = flash ? '#3d7bff' : '#ff4040';
      g.beginPath(); g.arc(px(c.x), pz(c.z), 3, 0, 7); g.fill();
    }
    // mission marker in gold
    if (marker) {
      g.fillStyle = '#ffd23c';
      g.beginPath(); g.arc(px(marker.x), pz(marker.z), 4.5, 0, 7); g.fill();
      g.strokeStyle = '#fff3b0'; g.lineWidth = 1.5; g.stroke();
    }
    // player arrow (heading up = player facing)
    g.save();
    g.translate(half, half);
    g.rotate(0);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = '#20303c'; g.lineWidth = 1.2; g.stroke();
    g.restore();
    // north tick
    g.fillStyle = '#ffffff'; g.font = 'bold 11px Arial'; g.textAlign = 'center';
    g.fillText('N', half, 13);
  }
}
