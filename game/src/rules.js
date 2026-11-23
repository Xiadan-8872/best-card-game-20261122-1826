// Four Winds: the rules. One job: pure functions for values and rounds,
// with no state, so the AI, the world and the tests all agree.
import { STORM_VALUE, WIND_BONUS, WIND_ORDER } from './config.js';

/** A card's fighting value this round: its face value, +4 on the wind suit. */
export function effectiveValue(card, windSuit) {
  if (!card) return 0;
  if (card.storm) return STORM_VALUE;
  return card.value + (card.suit === windSuit ? WIND_BONUS : 0);
}

/**
 * Resolve one revealed round. Higher effective value wins; the loser takes
 * damage equal to the difference (minimum 1). A tie deals no damage.
 */
export function resolveRound(playerCard, aiCard, windSuit) {
  const playerEff = effectiveValue(playerCard, windSuit);
  const aiEff = effectiveValue(aiCard, windSuit);
  let winner = 'tie';
  let damage = 0;
  if (playerEff > aiEff) {
    winner = 'player';
    damage = Math.max(1, playerEff - aiEff);
  } else if (aiEff > playerEff) {
    winner = 'ai';
    damage = Math.max(1, aiEff - playerEff);
  }
  return { playerEff, aiEff, winner, damage };
}

/**
 * The wind for the next round. A Storm card sets it to the Storm's suit
 * (the player's Storm wins the tie-break when both play one); otherwise
 * the wind rotates in its fixed visible order.
 */
export function nextWindIndex(currentIndex, playerCard, aiCard) {
  if (playerCard && playerCard.storm) return WIND_ORDER.indexOf(playerCard.suit);
  if (aiCard && aiCard.storm) return WIND_ORDER.indexOf(aiCard.suit);
  return (currentIndex + 1) % WIND_ORDER.length;
}

export function windSuitAt(index) {
  return WIND_ORDER[((index % WIND_ORDER.length) + WIND_ORDER.length) % WIND_ORDER.length];
}
