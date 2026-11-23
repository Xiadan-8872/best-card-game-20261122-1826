// Four Winds: the deck. One job: build, shuffle and draw the 40-card deck.
// Deck: 4 suits x values 1-9, plus 4 Storm cards (one per suit, value 0).
import { SUITS } from './config.js';
import { shuffleInPlace } from './random.js';

export function buildDeck(rng) {
  const cards = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= 9; value += 1) {
      cards.push({ suit: suit.id, value, storm: false });
    }
    cards.push({ suit: suit.id, value: 0, storm: true });
  }
  return shuffleInPlace(cards, rng);
}

/**
 * Draw one card, reshuffling the discard pile into the deck when it runs
 * dry. Returns null only when deck and discards are both empty.
 */
export function drawCard(deck, discards, rng) {
  if (deck.length === 0) {
    if (discards.length === 0) return null;
    deck.push(...shuffleInPlace(discards.splice(0), rng));
  }
  return deck.pop();
}

/** A short label for a card, used by the status line and debug logs. */
export function cardLabel(card) {
  if (!card) return '—';
  if (card.storm) return `Storm ${card.suit}`;
  return `${card.value} ${card.suit}`;
}
