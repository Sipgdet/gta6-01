// SOLMARA — shared tuning and world data. One place for every number the
// rest of the game reads, so a balance tweak never means hunting through
// the simulation.
export const WORLD = {
  // City is a grid of blocks. BLOCK is the block pitch, ROAD the road width.
  blocks: 5, // blocks per side (5x5 blocks, 6x6 roads)
  block: 46,
  road: 14,
  // Half-extent of the drivable city, in world units.
  get half() { return (this.blocks * this.block + (this.blocks + 1) * this.road) / 2; },
  get pitch() { return this.block + this.road; },
};

export const PLAYER = {
  walkSpeed: 9,
  runSpeed: 14,
  radius: 0.9,
  maxHealth: 100,
};

export const CAR = {
  accel: 26,
  reverseAccel: 14,
  maxSpeed: 46,
  maxReverse: 12,
  steer: 2.1,
  grip: 6.5,
  brake: 40,
  handbrakeTurn: 3.4,
};

export const WANTED = {
  max: 5,
  // Heat added by each crime; heat decays slowly while no crime happens.
  stealCar: 1.0,
  hitPed: 0.6,
  hitCar: 0.25,
  shoot: 0.8,
  speedNearCop: 0.15,
  decayPerSec: 0.02,
  // Stars shown = ceil(heat) while heat > 0. Police count by stars.
  copsForStars: [0, 1, 2, 3, 4, 6],
};

export const MISSIONS = [
  {
    id: 1,
    title: 'First Run',
    giver: 'MARA QUINN — fixer',
    brief: 'Pick up the parcel at the docks and bring it to the Neon Plaza drop.',
    lines: [
      'MARA: Dax, you drive? Good. Parcel at the docks, blue marker. No questions.',
      'MARA: Cops sniff around the plaza — keep it clean and the cash is yours.',
    ],
    pay: 250,
    pickup: { x: -118, z: -118 },
    drop: { x: 96, z: -96 },
  },
  {
    id: 2,
    title: 'Hot Wheels',
    giver: 'MARA QUINN — fixer',
    brief: 'The crew needs a getaway car. Take any car you like — fast — and reach the garage before the clock runs out.',
    lines: [
      'MARA: Job two. The crew is waiting at the garage, south side. Bring wheels. Any wheels.',
      'MARA: Borrow, don\'t buy. You know what I mean. 90 seconds, Dax.',
    ],
    pay: 400,
    timeLimit: 90,
    drop: { x: -96, z: 118 },
  },
  {
    id: 3,
    title: 'The Long Night',
    giver: 'MARA QUINN — fixer',
    brief: 'One last delivery across town. The whole precinct is awake — lose the tail, make the drop, and Solmara is yours.',
    lines: [
      'MARA: Last one. Cross town to the old casino. They will come for you. Don\'t stop.',
      'MARA: Make the drop and you\'re out. Welcome to Solmara, Dax Vell.',
    ],
    pay: 900,
    pickup: { x: 118, z: 118 },
    drop: { x: -118, z: 96 },
    heatOnStart: 2,
  },
];

export const DAY = {
  // Lighting presets the game cycles through: dusk by default, night for
  // the night shot, dawn for the mission shot.
  dusk: { sky: 0x2a1a4a, sun: 0xff9a5c, sunI: 1.1, amb: 0x4a3a6a, ambI: 0.55, fog: 0x2a1a4a },
  night: { sky: 0x0b0b1e, sun: 0x9aa8ff, sunI: 0.5, amb: 0x35355a, ambI: 0.65, fog: 0x0b0b1e },
  dawn: { sky: 0x3a2a3a, sun: 0xffb070, sunI: 0.9, amb: 0x3a2a50, ambI: 0.5, fog: 0x3a2a3a },
};

export const COLORS = {
  asphalt: 0x1c1c22,
  sidewalk: 0x3a3a42,
  buildingBase: [0x2e2a3e, 0x3a2e2e, 0x2a3a3e, 0x40303a, 0x2e3a2e],
  neon: [0xff2a6d, 0x05d9e8, 0xffd319, 0xb967ff, 0x39ff88],
  carPaint: [0xd7263d, 0x1b9aaa, 0xf4d35e, 0x5a189a, 0x06d6a0, 0xff7b00, 0xe8e8e8, 0x222222],
  policePaint: 0x1a1a2e,
};
