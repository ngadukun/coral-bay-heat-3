// missions-data.js — the thirteen-mission story of Coral Bay Heat.
// Steps: talk / goto / points / follow / fight / defend / buoys.
// Mari Solano owes the harbour money; every job pays a piece of the debt off.
import { LOCATIONS as L } from './city.js';

export const MISSIONS = [
  {
    title: 'Welcome Home', giver: 'Aunt Rosa', reward: 150,
    steps: [
      { k: 'talk', who: 'Aunt Rosa', text: 'Mari! You came home. The café is drowning, niña — drive an old woman home, then we talk business.' },
      { k: 'goto', x: L.rosaHouse.x, z: L.rosaHouse.z, inCar: true, obj: "Drive Aunt Rosa to her house in the Suburbs" },
      { k: 'talk', who: 'Aunt Rosa', text: 'The harbour people lent me money I could not refuse. You drive like your father — they will hire you. Start with the café run.' },
      { k: 'goto', x: L.cafe.x, z: L.cafe.z, inCar: true, obj: "Take Rosa back to Rosa's Café at the Marina" },
    ],
  },
  {
    title: 'Collections', giver: 'Aunt Rosa', reward: 300,
    steps: [
      { k: 'talk', who: 'Aunt Rosa', text: 'Three debtors in the Suburbs owe the café. Visit them all before sundown. One of them — Tito — will run. They always run.' },
      { k: 'points', pts: [[-196, 24], [-136, -96], [-76, 36]], time: 260, obj: 'Visit the three debtors (checkpoints)' },
      { k: 'follow', route: [[-76, 36], [-60, 36], [-60, 96], [-120, 96], [-120, 36]], dur: 25, obj: "Tito is running! Stay on his tail — not too close, not too far" },
      { k: 'goto', x: L.cafe.x, z: L.cafe.z, obj: "Return to Rosa's Café" },
    ],
  },
  {
    title: 'Hot Cargo', giver: 'Valen Cruz', reward: 450, pistol: true,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'Valen Cruz, harbour fixer. A coral-red sports car sleeps at the Port with something in its trunk. Bring it to the Downtown lockup. Its alarm is… enthusiastic. Take this pistol.' },
      { k: 'goto', x: L.portYard.x, z: L.portYard.z, obj: 'Go to the Port Yard', spawnCar: { type: 'sports', color: 0xe2543e, x: 228, z: -18, angle: 0.4 } },
      { k: 'goto', x: L.lockup.x, z: L.lockup.z, inMissionCar: true, wanted: 2, obj: 'Deliver the hot car to the Downtown Lockup — lose the heat or outrun it' },
    ],
  },
  {
    title: 'Beach Party Bust', giver: 'Aunt Rosa', reward: 400,
    steps: [
      { k: 'talk', who: 'Aunt Rosa', text: 'The beach crew skimmed the café takings and threw a party with them. Walk in, take the cash case by the lifeguard tower, and vanish.' },
      { k: 'goto', x: L.beachParty.x, z: L.beachParty.z, r: 16, obj: 'Head to the beach party at Coral Beach' },
      { k: 'goto', x: -188, z: 250, r: 3.2, obj: 'Grab the cash case by the lifeguard tower' },
      { k: 'goto', x: L.hideout.x, z: L.hideout.z, wanted: 2, obj: 'Escape to the Marina Hideout' },
    ],
  },
  {
    title: 'The Middleman', giver: 'Valen Cruz', reward: 650,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'A middleman moves product through my harbour tonight. Tail him to the warehouse — if he smells you, the deal dies.' },
      { k: 'follow', route: [[34, -60], [120, -60], [180, -60], [216, -92]], dur: 55, spawnAt: [24, -52], obj: 'Tail the middleman to the Harbour Warehouse' },
      { k: 'talk', who: 'Valen Cruz', text: 'The deal went wrong the second you arrived — they are drawing guns. Finish it, Mari.' },
      { k: 'fight', x: L.warehouse.x, z: L.warehouse.z, n: 4, obj: 'Survive the warehouse shootout' },
      { k: 'goto', x: L.hideout.x, z: L.hideout.z, obj: 'Slip away to the Marina Hideout' },
    ],
  },
  {
    title: 'Night Run', giver: 'Valen Cruz', reward: 800, timeOfDay: 0.94,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'One package, four drops, whole island, before the clock eats you. The night is yours — the police disagree.' },
      { k: 'points', pts: [[196, 176], [96, -176], [-196, -116], [-36, 196]], time: 230, wanted: 1, obj: 'Night Run: hit all four drops before time runs out' },
    ],
  },
  {
    title: 'Settle Up', giver: 'Aunt Rosa', reward: 900,
    steps: [
      { k: 'talk', who: 'Aunt Rosa', text: 'They are coming to burn my café tonight, Mari. Three cars of them. Hold the street. For your father.' },
      { k: 'defend', x: L.cafe.x, z: L.cafe.z, waves: 3, obj: "Defend Rosa's Café — hold the street through every wave" },
      { k: 'talk', who: 'Aunt Rosa', text: 'The café stands. The debt… is almost settled. One harbour job remains, and it is the big one.' },
    ],
  },
  {
    title: 'The Harbour Job', giver: 'Valen Cruz', reward: 1600,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'Finale of the old debt: a boat trailer at the Port carries everything the harbour ever stole. Hook it, and run it to the marina. Every badge in the bay will chase you.' },
      { k: 'goto', x: L.portYard.x, z: L.portYard.z, obj: 'Get to the Port Yard', spawnCar: { type: 'truck', color: 0x33404d, x: 214, z: -30, angle: -0.5 } },
      { k: 'goto', x: 236, z: 8, r: 6, inMissionCar: true, obj: 'Hook the marked boat trailer' },
      { k: 'goto', x: L.hideout.x, z: L.hideout.z, inMissionCar: true, wanted: 5, obj: 'FIVE STARS — run the trailer to the Marina Hideout!' },
    ],
  },
  {
    title: "Harbor Nights: Night Ledger", giver: 'Valen Cruz', reward: 700, timeOfDay: 0.9,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'New ledger, new nights, Mari. Someone cooks the harbour books at the warehouse after dark. Persuade them to stop.' },
      { k: 'goto', x: L.warehouse.x, z: L.warehouse.z, obj: 'Go to the Harbour Warehouse by night' },
      { k: 'fight', x: L.warehouse.x, z: L.warehouse.z, n: 3, obj: 'Clear the warehouse crew' },
      { k: 'goto', x: L.marinaPier.x, z: L.marinaPier.z, obj: 'Meet Valen at the Marina Pier' },
    ],
  },
  {
    title: 'Harbor Nights: Buoy Money', giver: 'Valen Cruz', reward: 550,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'My neon buoys mark drop points around the island. Wade out, tap three of them so the boats know the lane is open. Mind the cold.' },
      { k: 'buoys', n: 3, obj: 'Tap 3 neon buoys in the water around the island' },
      { k: 'goto', x: L.cafe.x, z: L.cafe.z, obj: "Report back at Rosa's Café" },
    ],
  },
  {
    title: "Harbor Nights: Smuggler's Tide", giver: 'Valen Cruz', reward: 1000, timeOfDay: 0.86,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'A van at the Port gate, a quiet beach, a fast tide. Deliver before the harbour patrol wakes up.' },
      { k: 'goto', x: L.portGate.x, z: L.portGate.z, obj: 'Pick up the van at the Port Gate', spawnCar: { type: 'van', color: 0x279ea8, x: 190, z: 72, angle: 1.2 } },
      { k: 'goto', x: -150, z: 232, inMissionCar: true, time: 150, wanted: 3, obj: "Run the van to the Coral Beach drop — don't be late" },
    ],
  },
  {
    title: 'Neon Grand Prix', giver: 'Valen Cruz', reward: 1200, timeOfDay: 0.92,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'Street race, harbour rules: my neon loop through downtown and the coast road. Beat the clock and the purse is yours — and the street remembers your name.' },
      { k: 'points', pts: [[60, -60], [180, -60], [240, 60], [180, 180], [60, 240], [-60, 180], [-60, 60], [0, -60]], time: 165, wanted: 1, obj: 'NEON GRAND PRIX — burn through all 8 checkpoints!' },
      { k: 'goto', x: L.marinaPier.x, z: L.marinaPier.z, obj: 'Collect your purse at the Marina Pier' },
    ],
  },
  {
    title: 'Fireworks Finale', giver: 'Valen Cruz', reward: 2500, timeOfDay: 0.88,
    steps: [
      { k: 'talk', who: 'Valen Cruz', text: 'Last job of the ledger, Mari. A rival crew wants the marina on fireworks night. Hold the pier, then watch the sky you bought back.' },
      { k: 'goto', x: L.marinaPier.x, z: L.marinaPier.z, obj: 'Reach the Marina Pier before the show' },
      { k: 'fight', x: -30, z: 256, n: 5, obj: 'Drive the rival crew off the pier' },
      { k: 'goto', x: -20, z: 246, r: 7, fireworks: true, obj: 'Watch the fireworks over the marina — you earned this sky' },
      { k: 'talk', who: 'Valen Cruz', text: 'The ledger is closed, the harbour is quiet, and Coral Bay is yours again. Drive safe, Mari.' },
    ],
  },
];
