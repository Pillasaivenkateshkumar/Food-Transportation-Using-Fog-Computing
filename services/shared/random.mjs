export function createSeededRandom(seedText) {
  let seed = 0;

  for (const character of seedText) {
    seed = (seed << 5) - seed + character.charCodeAt(0);
    seed |= 0;
  }

  return function nextRandom() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
