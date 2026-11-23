# Four Winds — an elemental card duel

[![bounty](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/Xiadan-8872/best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/Xiadan-8872/best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

An original card game built for the [best-card-game-20261122-1826 bounty](https://make.fun/bounty/best-card-game-20261122-1826) on make.fun.

## The game

You duel a rival across a felt table. Each of you has **20 life**; the first
to 0 loses. Every round you both play one card face down, then reveal.

- **The deck:** 40 cards — four suits (Ember, Tide, Leaf, Stone) valued 1–9,
  plus four Storm cards, one per suit.
- **The wind:** one suit is the wind each round and rotates in a fixed
  visible order (Ember → Tide → Leaf → Stone). A card of the wind suit is
  worth **+4**, and the *next* wind is always shown, so you can plan ahead.
- **Storm cards** are worth 5 and set the *next* round's wind to their suit —
  flip the wind to favour the hand you hold.
- **The round:** higher effective value wins; the loser takes damage equal
  to the difference (minimum 1). A tie deals no damage. Both players draw
  one card. Both discard piles stay visible on the table, so you can count
  cards.

Depth comes from hand management (save wind-matching cards), wind planning
(the next wind is visible), Storm timing, and card counting.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **Click a card** (or press **1–5**) to play it.
- **Space** to start / play again, **P** to pause.
- No network, no build step, no audio files — sounds are WebAudio synth.
- Screenshots are real renders of the game: `node tools/shoot.mjs` serves
  `game/` headlessly and captures the four `?shot=` scenes.

## Files

| File | Job |
| --- | --- |
| `main.ts` | Entry point: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |
| `serve.ts` | Tiny static dev server for `game/` on :8080 |
| `shots.json` | The four screenshot scenes |
| `game/index.html` | Shell: full-screen canvas + status line |
| `game/src/config.js` | Suits, colours, sizes, life, wind order |
| `game/src/random.js` | Seeded RNG (mulberry32) |
| `game/src/deck.js` | 40-card deck, shuffle, draw, reshuffle |
| `game/src/rules.js` | Effective value, wind, Storm, round resolution |
| `game/src/ai.js` | The rival: greedy with lookahead, saves strong cards |
| `game/src/world.js` | State machine: title / play / reveal / over |
| `game/src/render.js` | All canvas drawing: table, cards, life bars, screens |
| `game/src/input.js` | Mouse + keyboard |
| `game/src/audio.js` | WebAudio synth bleeps |
| `game/src/shots.js` | Autopilot staging for the four screenshots |
| `game/src/main.js` | Boot, fixed-step loop, `?shot` handling |
| `tools/shoot.mjs` | Headless CDP screenshot driver + live play-test |
| `vendor/makefun-game.ts` | make.fun dossier library, copied from the kit unchanged |

## License

MIT — see [LICENSE](LICENSE).
