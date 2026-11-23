// Four Winds: shared constants. One job: the numbers and names every other
// module agrees on, so a balance tweak lives in exactly one place.
export const CANVAS_W = 1280;
export const CANVAS_H = 800;
export const CARD_W = 110;
export const CARD_H = 154;
export const START_LIFE = 20;
export const HAND_SIZE = 5;
export const WIND_BONUS = 4;
export const STORM_VALUE = 5;
export const REVEAL_SECONDS = 1.2;
export const STEP = 1 / 60;
export const BEST_KEY = 'four-winds-best';

// Four suits, told apart by colour AND shape (never by text alone).
export const SUITS = [
  { id: 'ember', name: 'Ember', color: '#e5484d', dark: '#8f1d21', shape: 'triangle' },
  { id: 'tide', name: 'Tide', color: '#3e8ef7', dark: '#174a94', shape: 'droplet' },
  { id: 'leaf', name: 'Leaf', color: '#46a758', dark: '#1d5c2c', shape: 'diamond' },
  { id: 'stone', name: 'Stone', color: '#f5a524', dark: '#8a5a08', shape: 'square' },
];

export const WIND_ORDER = ['ember', 'tide', 'leaf', 'stone'];

export function suitById(id) {
  return SUITS.find((s) => s.id === id) ?? SUITS[0];
}
