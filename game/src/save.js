// save.js — localStorage persistence for campaign progress.
const KEY = 'coralBayHeatSaveV1';
export const defaultSave = () => ({
  missionIndex: 0, cash: 250, shells: [], buoys: [], pistol: false, ammo: 24,
  totalEarned: 0, racesWon: 0, faresDone: 0, stuntsDone: [],
  pos: { x: -196, z: 196 }, started: false,
});
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Object.assign(defaultSave(), data);
  } catch { return null; }
}
export function storeSave(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
