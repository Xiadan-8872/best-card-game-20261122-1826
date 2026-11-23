// Four Winds: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between title, play, reveal, paused and over.
// ?seed=N fixes the deal. ?shot=start|play|win|loss (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import {
  BEST_KEY, CANVAS_H, CANVAS_W, STEP,
} from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_DAMAGE, EVENT_OVER, EVENT_PLAY, EVENT_STORM,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, playerCardAt, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.startGame();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Four Winds. You have 20 life. Play a card.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.playerRounds > best) {
      best = world.state.playerRounds;
      saveBest(best);
    }
    if (world.state.winner === 'player') audio.fanfare();
    else audio.lowNote();
    announce(world.state.winner === 'player'
      ? `Victory. You won ${world.state.playerRounds} rounds with ${world.state.playerLife} life left. Best ${best}.`
      : `Defeat. You won ${world.state.playerRounds} rounds. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PLAY) audio.click();
    if (events & EVENT_STORM) audio.chime();
    if (events & EVENT_DAMAGE) {
      audio.damage();
      if (world.state.reveal && world.state.reveal.winner === 'player') audio.chime();
    }
    if (events & EVENT_OVER) endGame();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playFromInput() {
    if (screen !== SCREEN_PLAY) return;
    const picked = input.takeNumber();
    if (picked >= 0) {
      handleEvents(world.playCard(picked));
      return;
    }
    if (input.takeClick()) {
      const index = playerCardAt(world.state, input.mouse.x, input.mouse.y);
      if (index >= 0) handleEvents(world.playCard(index));
    }
  }

  function stepWorld() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    handleEvents(world.update(STEP));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    playFromInput();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const hover = screen === SCREEN_PLAY
      ? playerCardAt(world.state, input.mouse.x, input.mouse.y)
      : -1;
    renderer.draw(world.state, screen, best, hover);
  }

  // Leaving the tab pauses a running game rather than letting a reveal run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Four Winds. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
