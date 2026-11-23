// Four Winds: the rival AI. One job: pick one card from a hand.
// Skill 1 (sharp): save strong cards, win cheap, flip a bad wind with a
// Storm. Skill 0 (careless): play the weakest card and waste its Storms.
import { effectiveValue } from './rules.js';

function handStats(hand, windSuit) {
  const effs = hand.map((card) => effectiveValue(card, windSuit));
  const windMatches = hand.filter((card) => !card.storm && card.suit === windSuit).length;
  return { effs, windMatches };
}

/**
 * Pick a card index. `skill` is 0 (careless) or 1 (sharp); `nextWindSuit`
 * is the wind after this round, so a Storm can be aimed at it.
 */
export function chooseCard(hand, windSuit, nextWindSuit, skill, rng) {
  if (hand.length === 0) return -1;
  const { effs, windMatches } = handStats(hand, windSuit);

  if (skill <= 0) {
    // Careless: the weakest card, Storm included — it throws games away.
    let worst = 0;
    for (let i = 1; i < hand.length; i += 1) {
      if (effs[i] < effs[worst]) worst = i;
    }
    return worst;
  }

  // Sharp: a Storm is worth playing when the current wind starves this hand
  // but the Storm's suit would feed it next round.
  for (let i = 0; i < hand.length; i += 1) {
    const card = hand[i];
    if (!card.storm) continue;
    const feedsNext = hand.filter((c) => !c.storm && c.suit === card.suit).length;
    const stormSuitsNext = card.suit === nextWindSuit;
    if (windMatches <= 1 && (feedsNext >= 2 || stormSuitsNext)) return i;
  }

  // Win cheap: the smallest card likely to take the round (a rival usually
  // shows 5-8), so the big cards stay in hand for later.
  let cheapestWin = -1;
  for (let i = 0; i < hand.length; i += 1) {
    if (effs[i] >= 7 && (cheapestWin === -1 || effs[i] < effs[cheapestWin])) cheapestWin = i;
  }
  if (cheapestWin !== -1) return cheapestWin;

  // Nothing likely wins: spend the weakest card and keep the strong ones.
  let weakest = 0;
  for (let i = 1; i < hand.length; i += 1) {
    if (effs[i] < effs[weakest]) weakest = i;
  }
  // Occasionally (1 in 8) vary the pick so the rival is not perfectly readable.
  if (rng && rng() < 0.125 && hand.length > 1) {
    return Math.floor(rng() * hand.length);
  }
  return weakest;
}
