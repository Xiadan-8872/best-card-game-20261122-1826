// Four Winds: screenshot staging. One job: drive the real rules forward
// from a fresh world with a fixed seed, so each ?shot= frame is what a
// short real game looks like — never a hand-drawn mock.
//   start: fresh world, title screen.
//   play:  ~8 real rounds, then freeze mid-reveal (both cards visible,
//          life already reduced, discards on the table).
//   win:   the player plays sharp, the rival careless, until rival life 0.
//   loss:  the rival plays sharp, the player careless, until player life 0.
import { STEP } from './config.js';
import { chooseCard } from './ai.js';
import { effectiveValue } from './rules.js';
import { EVENT_OVER } from './world.js';
import {
  SCREEN_OVER, SCREEN_PLAY, SCREEN_REVEAL, SCREEN_TITLE,
} from './render.js';

const PLAY_ROUNDS = 8;
const MAX_ROUNDS = 120;

/** Play one scripted round and move on; returns false when the game ends. */
function scriptedRound(world, playerSkill, aiSkill) {
  const { state } = world;
  if (state.screen !== 'play') return false;
  const p = chooseCard(state.playerHand, world.windSuit(), world.nextWindSuit(), playerSkill, null);
  const a = chooseCard(state.aiHand, world.windSuit(), world.nextWindSuit(), aiSkill, null);
  if (p < 0 || a < 0) return false;
  world.debugRound(p, a);
  // The reveal timer would normally end the round; jump straight there.
  const events = world.finishReveal();
  return !(events & EVENT_OVER);
}

/** Let the deal animation finish and the played cards settle. */
function settle(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP);
}

/** The closest-matched pair of cards in the two hands: the final reveal
 *  round of the play shot uses it, so the freeze frame shows a live
 *  mid-game table instead of a killing blow. */
function closestPair(world) {
  const { state } = world;
  const wind = world.windSuit();
  let bestP = 0;
  let bestA = 0;
  let bestDiff = Infinity;
  for (let p = 0; p < state.playerHand.length; p += 1) {
    for (let a = 0; a < state.aiHand.length; a += 1) {
      const diff = Math.abs(
        effectiveValue(state.playerHand[p], wind) - effectiveValue(state.aiHand[a], wind),
      );
      if (diff < bestDiff) {
        bestDiff = diff;
        bestP = p;
        bestA = a;
      }
    }
  }
  return { p: bestP, a: bestA };
}

export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'loss') {
    // Title: let the idle sway run a few seconds so the fan settles.
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  world.startGame();
  settle(world, 0.5); // deal animation finishes; the hand sits at the bottom
  if (name === 'play') {
    let rounds = PLAY_ROUNDS;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let endedEarly = false;
      for (let r = 0; r < rounds; r += 1) {
        if (!scriptedRound(world, 1, 1)) { endedEarly = true; break; }
        // Stop while both sides are still alive with room to spare.
        if (world.state.playerLife <= 7 || world.state.aiLife <= 7) break;
      }
      if (!endedEarly && world.state.screen === 'play'
        && world.state.playerLife > 7 && world.state.aiLife > 7) break;
      // The scripted duel ended, or a side is nearly dead: start over and
      // play fewer rounds so the reveal shot is a live mid-game table.
      world.reset();
      world.startGame();
      settle(world, 0.5);
      rounds = Math.max(2, rounds - 3);
    }
    // One last round, frozen at the reveal: both cards face up, the
    // damage already on the life bars, discards from earlier rounds visible.
    // The closest-matched pair keeps the blow small, so nobody dies here.
    const { state } = world;
    if (state.screen === 'play') {
      const pair = closestPair(world);
      world.debugRound(pair.p, pair.a);
      settle(world, 0.6); // played cards slide in, damage flash fades; the reveal itself holds
    }
    return { screen: SCREEN_REVEAL, best: world.state.playerRounds };
  }

  // win / loss: a lopsided duel that really ends 20-0 in life.
  const playerSkill = name === 'win' ? 1 : 0;
  const aiSkill = name === 'win' ? 0 : 1;
  for (let r = 0; r < MAX_ROUNDS; r += 1) {
    if (!scriptedRound(world, playerSkill, aiSkill)) break;
    if (world.state.screen === 'over') break;
  }
  // If the lopsided duel somehow stalled, keep playing sharp-vs-careless
  // rounds until somebody's life reaches zero (the loop above already
  // covers it; this is only a guard for a pathological seed).
  let guard = 0;
  while (world.state.screen !== 'over' && guard < MAX_ROUNDS) {
    if (!scriptedRound(world, playerSkill, aiSkill)) break;
    guard += 1;
  }
  // Let the win flourish spread before the frame is taken.
  settle(world, 0.75);
  return { screen: SCREEN_OVER, best: world.state.playerRounds };
}

// Keep the play-scene screen name import used by main.js's shot path.
export { SCREEN_PLAY };
