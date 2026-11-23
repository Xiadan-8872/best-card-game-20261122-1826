// Four Winds: the world. One job: the state machine — title, play, reveal,
// over — plus hands, life, rounds, the wind, draws and animation timers.
// The renderer only paints this state; it never changes the rules.
import {
  HAND_SIZE, REVEAL_SECONDS, START_LIFE, STEP,
} from './config.js';
import { buildDeck, drawCard } from './deck.js';
import { nextWindIndex, resolveRound, windSuitAt } from './rules.js';
import { chooseCard } from './ai.js';

export const EVENT_NONE = 0;
export const EVENT_PLAY = 1;
export const EVENT_DAMAGE = 2;
export const EVENT_STORM = 4;
export const EVENT_OVER = 8;

export function createWorld(rng) {
  const state = freshState();

  function freshState() {
    return {
      screen: 'title',
      deck: [],
      playerDiscard: [],
      aiDiscard: [],
      playerHand: [],
      aiHand: [],
      playerPlayed: null,
      aiPlayed: null,
      playerLife: START_LIFE,
      aiLife: START_LIFE,
      round: 1,
      windIndex: 0,
      playerRounds: 0,
      aiRounds: 0,
      winner: null,
      reveal: null,
      revealT: 0,
      message: 'Click a card to play it. The wind favours its own suit.',
      flashT: 0,
      flashSide: null,
      dealT: 0,
      playT: 0,
      time: 0,
      particles: [],
    };
  }

  function dealHands() {
    state.deck = buildDeck(rng);
    state.playerHand = [];
    state.aiHand = [];
    for (let i = 0; i < HAND_SIZE; i += 1) {
      state.playerHand.push(drawCard(state.deck, state.playerDiscard, rng));
      state.aiHand.push(drawCard(state.deck, state.aiDiscard, rng));
    }
  }

  function reset() {
    const kept = state.time;
    Object.assign(state, freshState());
    state.time = kept;
    dealHands();
  }

  function startGame() {
    reset();
    state.screen = 'play';
    state.dealT = 0.45;
    state.message = 'Your turn — play a card. Wind cards are worth +4.';
  }

  function windSuit() {
    return windSuitAt(state.windIndex);
  }

  function nextWindSuit() {
    return windSuitAt(state.windIndex + 1);
  }

  /** Begin the reveal of one round. Damage lands at once (the screenshot
   *  freezes a reveal with life already reduced); the cards leave the
   *  table when the reveal ends. */
  function beginRound(playerIndex, aiIndex) {
    const playerCard = state.playerHand.splice(playerIndex, 1)[0];
    const aiCard = state.aiHand.splice(aiIndex, 1)[0];
    state.playerPlayed = playerCard;
    state.aiPlayed = aiCard;
    const outcome = resolveRound(playerCard, aiCard, windSuit());
    state.reveal = outcome;
    state.revealT = 0;
    state.screen = 'reveal';
    state.playT = 0.35;
    let events = EVENT_PLAY;
    if (playerCard.storm || aiCard.storm) events |= EVENT_STORM;
    if (outcome.winner === 'player') {
      state.aiLife = Math.max(0, state.aiLife - outcome.damage);
      state.playerRounds += 1;
      state.flashSide = 'ai';
      state.flashT = 0.5;
      events |= EVENT_DAMAGE;
    } else if (outcome.winner === 'ai') {
      state.playerLife = Math.max(0, state.playerLife - outcome.damage);
      state.aiRounds += 1;
      state.flashSide = 'player';
      state.flashT = 0.5;
      events |= EVENT_DAMAGE;
    }
    state.message = outcome.winner === 'tie'
      ? `Tie — ${outcome.playerEff} vs ${outcome.aiEff}. No damage.`
      : outcome.winner === 'player'
        ? `You win the round ${outcome.playerEff} vs ${outcome.aiEff} — rival takes ${outcome.damage}.`
        : `Rival wins the round ${outcome.aiEff} vs ${outcome.playerEff} — you take ${outcome.damage}.`;
    if (state.playerLife <= 0 || state.aiLife <= 0) {
      state.winner = state.playerLife <= 0 ? 'ai' : 'player';
    }
    return events;
  }

  /** End the reveal: discards, draws, wind moves on, next round starts. */
  function finishReveal() {
    if (state.playerPlayed) state.playerDiscard.push(state.playerPlayed);
    if (state.aiPlayed) state.aiDiscard.push(state.aiPlayed);
    state.playerPlayed = null;
    state.aiPlayed = null;
    state.reveal = null;
    if (state.winner) {
      state.screen = 'over';
      if (state.winner === 'player') burstParticles();
      return EVENT_OVER;
    }
    state.windIndex = nextWindIndex(state.windIndex, state.playerDiscard[state.playerDiscard.length - 1], state.aiDiscard[state.aiDiscard.length - 1]);
    // The wind above must follow the cards just played, which are now the
    // last discards — but nextWindIndex reads them correctly either way.
    state.round += 1;
    const p = drawCard(state.deck, state.playerDiscard, rng);
    const a = drawCard(state.deck, state.aiDiscard, rng);
    if (p) state.playerHand.push(p);
    if (a) state.aiHand.push(a);
    state.screen = 'play';
    state.message = 'Your turn — play a card. Watch the next wind.';
    return EVENT_NONE;
  }

  function burstParticles() {
    const colors = ['#e5484d', '#3e8ef7', '#46a758', '#f5a524', '#ffd97a'];
    for (let i = 0; i < 90; i += 1) {
      const angle = rng() * Math.PI * 2;
      const speed = 60 + rng() * 260;
      state.particles.push({
        x: 640, y: 340, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60,
        life: 0.9 + rng() * 0.9, age: 0, color: colors[i % colors.length], size: 3 + rng() * 5,
      });
    }
  }

  /** A live player move: the rival answers at once, then the reveal runs. */
  function playCard(playerIndex) {
    if (state.screen !== 'play') return EVENT_NONE;
    if (playerIndex < 0 || playerIndex >= state.playerHand.length) return EVENT_NONE;
    const aiIndex = chooseCard(state.aiHand, windSuit(), nextWindSuit(), 1, rng);
    return beginRound(playerIndex, aiIndex);
  }

  /**
   * A scripted round for screenshots: both sides play the named cards and
   * the reveal freezes. Call finishReveal() to move on to the next round.
   */
  function debugRound(playerIndex, aiIndex) {
    if (state.screen !== 'play') return EVENT_NONE;
    return beginRound(playerIndex, aiIndex);
  }

  function update(dt) {
    state.time += dt;
    if (state.dealT > 0) state.dealT = Math.max(0, state.dealT - dt);
    if (state.playT > 0) state.playT = Math.max(0, state.playT - dt);
    if (state.flashT > 0) state.flashT = Math.max(0, state.flashT - dt);
    for (const p of state.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    }
    state.particles = state.particles.filter((p) => p.age < p.life);
    if (state.screen === 'reveal') {
      state.revealT += dt;
      if (state.revealT >= REVEAL_SECONDS) return finishReveal();
    }
    return EVENT_NONE;
  }

  /** Advance the world in fixed steps (used by the title idle animation). */
  function step(dt) {
    return update(dt);
  }

  return {
    state,
    reset,
    startGame,
    playCard,
    debugRound,
    finishReveal,
    update,
    step,
    windSuit,
    nextWindSuit,
  };
}

// Re-exported so shots.js can read the step size without importing config.
export { STEP };
