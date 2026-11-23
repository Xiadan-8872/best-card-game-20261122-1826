// Four Winds: the renderer. One job: paint every screen on the canvas —
// the felt table, the hands, the played cards, life bars, the wind, the
// title, win and loss screens — from world state, changing nothing.
import {
  CANVAS_H, CANVAS_W, CARD_H, CARD_W, START_LIFE, suitById,
} from './config.js';
import { effectiveValue, windSuitAt } from './rules.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_REVEAL = 'reveal';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSED = 'paused';

const FELT = '#14532d';
const FELT_DARK = '#0b3d20';
const GOLD = '#d9a441';
const CREAM = '#f7f1de';
const INK = '#1d2b22';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw one suit shape, centred at (x, y) with radius r, in its colour. */
export function drawSuitShape(ctx, suitId, x, y, r, color) {
  const suit = suitById(suitId);
  ctx.fillStyle = color ?? suit.color;
  ctx.beginPath();
  if (suit.shape === 'triangle') {
    // Ember: a flame-like triangle.
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.95, y + r * 0.8);
    ctx.lineTo(x - r * 0.95, y + r * 0.8);
  } else if (suit.shape === 'droplet') {
    // Tide: a droplet — round base, pointed top.
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r, y + r * 0.2, x, y + r * 0.85);
    ctx.quadraticCurveTo(x - r, y + r * 0.2, x, y - r);
  } else if (suit.shape === 'diamond') {
    // Leaf: a diamond.
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.85, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.85, y);
  } else {
    // Stone: a square, slightly rotated for a cut-gem look.
    ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  }
  ctx.closePath();
  ctx.fill();
}

/** The lightning bolt on a Storm card. */
function drawBolt(ctx, x, y, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + h * 0.08, y - h / 2);
  ctx.lineTo(x - h * 0.28, y + h * 0.08);
  ctx.lineTo(x - h * 0.02, y + h * 0.08);
  ctx.lineTo(x - h * 0.08, y + h / 2);
  ctx.lineTo(x + h * 0.28, y - h * 0.08);
  ctx.lineTo(x + h * 0.02, y - h * 0.08);
  ctx.closePath();
  ctx.fill();
}

function drawCardFace(ctx, card, x, y, w, h, scale) {
  const suit = suitById(card.suit);
  roundRect(ctx, x, y, w, h, 12 * scale);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.lineWidth = 3 * scale;
  ctx.strokeStyle = suit.color;
  ctx.stroke();
  ctx.fillStyle = suit.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (card.storm) {
    ctx.font = `bold ${Math.round(26 * scale)}px Georgia, serif`;
    ctx.fillText('0', x + 10 * scale, y + 8 * scale);
    drawBolt(ctx, x + w / 2, y + h * 0.42, 58 * scale, suit.color);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(17 * scale)}px Georgia, serif`;
    ctx.fillText('STORM', x + w / 2, y + h * 0.72);
    ctx.font = `${Math.round(11 * scale)}px Georgia, serif`;
    ctx.fillStyle = INK;
    ctx.fillText('wind +5', x + w / 2, y + h * 0.86);
    return;
  }
  ctx.font = `bold ${Math.round(30 * scale)}px Georgia, serif`;
  ctx.fillText(String(card.value), x + 10 * scale, y + 6 * scale);
  drawSuitShape(ctx, card.suit, x + 24 * scale, y + 46 * scale, 11 * scale);
  // Centre: the big readable value over the suit shape.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawSuitShape(ctx, card.suit, x + w / 2, y + h * 0.52, 30 * scale);
  ctx.fillStyle = 'rgba(247,241,222,0.92)';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.52, 24 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = suit.color;
  ctx.font = `bold ${Math.round(44 * scale)}px Georgia, serif`;
  ctx.fillText(String(card.value), x + w / 2, y + h * 0.52 + 1);
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.round(13 * scale)}px Georgia, serif`;
  ctx.fillText(suit.name.toUpperCase(), x + w / 2, y + h * 0.82);
}

function drawCardBack(ctx, x, y, w, h, scale) {
  roundRect(ctx, x, y, w, h, 12 * scale);
  ctx.fillStyle = '#274b8f';
  ctx.fill();
  ctx.lineWidth = 3 * scale;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  roundRect(ctx, x + 7 * scale, y + 7 * scale, w - 14 * scale, h - 14 * scale, 8 * scale);
  ctx.strokeStyle = 'rgba(217,164,65,0.7)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();
  // A four-point wind rose in the middle.
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 26 * scale, cy + Math.sin(a) * 26 * scale);
    ctx.lineTo(cx + Math.cos(a + 0.35) * 9 * scale, cy + Math.sin(a + 0.35) * 9 * scale);
    ctx.lineTo(cx + Math.cos(a - 0.35) * 9 * scale, cy + Math.sin(a - 0.35) * 9 * scale);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * scale, 0, Math.PI * 2);
  ctx.fillStyle = CREAM;
  ctx.fill();
}

export function drawCard(ctx, card, x, y, opts = {}) {
  const scale = opts.scale ?? 1;
  const w = CARD_W * scale;
  const h = CARD_H * scale;
  ctx.save();
  if (opts.rotate) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(opts.rotate);
    ctx.translate(-w / 2, -h / 2);
    x = 0;
    y = 0;
  }
  if (opts.faceDown || !card) drawCardBack(ctx, x, y, w, h, scale);
  else drawCardFace(ctx, card, x, y, w, h, scale);
  ctx.restore();
}

/** Where the player's hand cards sit (fan with a gentle arc). */
export function playerHandRects(state) {
  const n = state.playerHand.length;
  const gap = 118;
  const total = n * gap - 8;
  const startX = (CANVAS_W - total) / 2;
  const baseY = 622;
  return state.playerHand.map((card, i) => {
    const cx = (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
    return {
      x: startX + i * gap,
      y: baseY + Math.abs(cx) * 14,
      rotate: cx * 0.07,
      card,
      index: i,
    };
  });
}

/** Which player hand card (if any) sits under canvas point (x, y). */
export function playerCardAt(state, x, y) {
  const rects = playerHandRects(state);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + CARD_W && y >= r.y - 14 && y <= r.y + CARD_H) return i;
  }
  return -1;
}

function drawLifeBar(ctx, x, y, w, label, life, flash) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillStyle = CREAM;
  ctx.fillText(label, x, y + 12);
  const barX = x + 92;
  const barW = w - 92;
  roundRect(ctx, barX, y, barW, 22, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  const frac = Math.max(0, life / START_LIFE);
  if (frac > 0) {
    roundRect(ctx, barX + 2, y + 2, Math.max(10, (barW - 4) * frac), 18, 9);
    ctx.fillStyle = flash ? '#ff5d5d' : (frac > 0.5 ? '#46a758' : frac > 0.25 ? '#f5a524' : '#e5484d');
    ctx.fill();
  }
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${life} / ${START_LIFE}`, barX + barW - 8, y + 12);
  ctx.textAlign = 'left';
}

function drawWind(ctx, x, y, currentSuit, nextSuit) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.75)';
  ctx.fillText('WIND', x, y);
  const cur = suitById(currentSuit);
  roundRect(ctx, x, y + 12, 168, 46, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = cur.color;
  ctx.stroke();
  drawSuitShape(ctx, currentSuit, x + 26, y + 35, 13, cur.color);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px Georgia, serif';
  ctx.fillText(`${cur.name} +4`, x + 48, y + 35);
  const nxt = suitById(nextSuit);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.85)';
  ctx.fillText('Next:', x, y + 76);
  drawSuitShape(ctx, nextSuit, x + 58, y + 76, 9, nxt.color);
  ctx.fillText(nxt.name, x + 74, y + 76);
}

function drawTable(ctx, state, hoverIndex) {
  // Felt with a vignette and a gold-trimmed oval.
  const grad = ctx.createRadialGradient(640, 400, 120, 640, 400, 760);
  grad.addColorStop(0, FELT);
  grad.addColorStop(1, FELT_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(640, 400, 600, 330, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,65,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(640, 400, 585, 315, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Damage flash over the side that was just hurt.
  if (state.flashT > 0 && state.flashSide) {
    ctx.fillStyle = `rgba(229,72,77,${(state.flashT / 0.5) * 0.22})`;
    ctx.fillRect(0, state.flashSide === 'player' ? 420 : 0, CANVAS_W, 380);
  }

  drawLifeBar(ctx, 28, 22, 330, 'RIVAL', state.aiLife, state.flashSide === 'ai' && state.flashT > 0);
  drawLifeBar(ctx, 28, 742, 330, 'YOU', state.playerLife, state.flashSide === 'player' && state.flashT > 0);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(`ROUND ${state.round}`, 640, 30);
  ctx.font = '16px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.85)';
  ctx.fillText(`Rounds won — You ${state.playerRounds} · Rival ${state.aiRounds}`, 640, 56);

  drawWind(ctx, 1060, 18, windSuitAt(state.windIndex), windSuitAt(state.windIndex + 1));

  // Rival hand: face-down fan at the top.
  const n = state.aiHand.length;
  const gap = 78;
  const total = n * gap - 8;
  const startX = (CANVAS_W - total) / 2;
  state.aiHand.forEach((card, i) => {
    drawCard(ctx, card, startX + i * gap, 86, { faceDown: true, scale: 0.62, rotate: (i - (n - 1) / 2) * 0.03 });
  });
  ctx.textAlign = 'center';
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.8)';
  ctx.fillText(`Rival hand · ${n} cards`, 640, 196);

  // Discard piles with counts, at the table's edges.
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.75)';
  if (state.aiDiscard.length > 0) {
    drawCard(ctx, state.aiDiscard[state.aiDiscard.length - 1], 60, 300, { scale: 0.5 });
    ctx.fillText(`Rival discards ${state.aiDiscard.length}`, 115, 392);
  }
  if (state.playerDiscard.length > 0) {
    drawCard(ctx, state.playerDiscard[state.playerDiscard.length - 1], 1110, 300, { scale: 0.5 });
    ctx.fillText(`Your discards ${state.playerDiscard.length}`, 1165, 392);
  }

  // The played cards, centre stage.
  if (state.playerPlayed || state.aiPlayed) {
    const lift = state.playT > 0 ? (1 - state.playT / 0.35) : 1;
    const y = 268 + (1 - lift) * -30;
    if (state.aiPlayed) {
      drawCard(ctx, state.aiPlayed, 500, y, {});
      if (state.reveal) {
        ctx.font = 'bold 26px Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`= ${state.reveal.aiEff}`, 555, y + CARD_H + 26);
      }
    }
    if (state.playerPlayed) {
      drawCard(ctx, state.playerPlayed, 670, y, {});
      if (state.reveal) {
        ctx.font = 'bold 26px Georgia, serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`= ${state.reveal.playerEff}`, 725, y + CARD_H + 26);
      }
    }
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('VS', 640, y + CARD_H / 2);
  } else {
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = 'rgba(247,241,222,0.6)';
    ctx.fillText('— play a card to reveal the round —', 640, 340);
  }

  // Message line under the centre.
  ctx.textAlign = 'center';
  ctx.font = '19px Georgia, serif';
  ctx.fillStyle = state.reveal && state.reveal.winner !== 'tie' ? '#ffd97a' : CREAM;
  ctx.fillText(state.message, 640, 500);

  // Player hand, fanned, hovered card raised.
  const rects = playerHandRects(state);
  rects.forEach((r) => {
    const hovered = r.index === hoverIndex;
    const y = r.y - (hovered ? 26 : 0) - (state.dealT > 0 ? (1 - state.dealT / 0.45) * 0 + (state.dealT / 0.45) * 260 : 0);
    drawCard(ctx, r.card, r.x, y, { rotate: r.rotate });
    if (hovered) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      roundRect(ctx, r.x - 2, y - 2, CARD_W + 4, CARD_H + 4, 13);
      ctx.stroke();
    }
  });
  ctx.textAlign = 'center';
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.8)';
  ctx.fillText('Your hand — click a card, or press 1–5', 640, 612);
}

function drawTitle(ctx, state, best) {
  const grad = ctx.createRadialGradient(640, 360, 80, 640, 400, 780);
  grad.addColorStop(0, '#1c6b3c');
  grad.addColorStop(1, '#07271a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, CANVAS_W - 28, CANVAS_H - 28);

  // A fan of the four suits behind the title, swaying gently.
  const sway = Math.sin(state.time * 0.8) * 0.04;
  const fanCards = [
    { suit: 'ember', value: 9, storm: false },
    { suit: 'tide', value: 7, storm: false },
    { suit: 'leaf', value: 8, storm: false },
    { suit: 'stone', value: 0, storm: true },
  ];
  fanCards.forEach((card, i) => {
    drawCard(ctx, card, 400 + i * 118, 130, { rotate: (i - 1.5) * 0.12 + sway });
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 92px Georgia, serif';
  ctx.fillText('FOUR WINDS', 640, 380);
  ctx.fillStyle = CREAM;
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('An elemental card duel — twenty life, four winds, one rival.', 640, 440);
  ctx.font = '19px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.9)';
  ctx.fillText('Play a card each round. The wind suit is worth +4. Storm flips the next wind.', 640, 486);
  ctx.fillText('Higher card wins the round; the loser takes the difference in damage.', 640, 516);
  const blink = 0.55 + 0.45 * Math.sin(state.time * 3);
  ctx.fillStyle = `rgba(255,217,122,${blink.toFixed(2)})`;
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('Click or press Space to play', 640, 590);
  if (best > 0) {
    ctx.fillStyle = 'rgba(247,241,222,0.85)';
    ctx.font = '18px Georgia, serif';
    ctx.fillText(`Best: ${best} rounds won in a game`, 640, 640);
  }
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.6)';
  ctx.fillText('Keys: 1–5 play a card · Space start · P pause', 640, 700);
}

function drawOver(ctx, state, best) {
  const won = state.winner === 'player';
  const grad = ctx.createRadialGradient(640, 400, 60, 640, 400, 780);
  grad.addColorStop(0, won ? '#1c6b3c' : '#5c1a1a');
  grad.addColorStop(1, '#0a0f0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Win flourish: the particles the world spawned.
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = won ? '#ffd97a' : '#ff8a8a';
  ctx.font = 'bold 96px Georgia, serif';
  ctx.fillText(won ? 'VICTORY' : 'DEFEAT', 640, 300);
  ctx.fillStyle = CREAM;
  ctx.font = '26px Georgia, serif';
  ctx.fillText(
    won
      ? `The rival falls. You kept ${state.playerLife} life and won ${state.playerRounds} rounds.`
      : `The rival takes the table. You won ${state.playerRounds} rounds over ${state.round} rounds.`,
    640, 400,
  );
  ctx.font = '20px Georgia, serif';
  ctx.fillStyle = 'rgba(247,241,222,0.9)';
  ctx.fillText(`Final score — You ${state.playerLife} life · Rival ${state.aiLife} life`, 640, 452);
  if (best > 0) {
    ctx.fillText(`Best: ${best} rounds won in a game`, 640, 490);
  }
  const blink = 0.55 + 0.45 * Math.sin(state.time * 3);
  ctx.fillStyle = `rgba(255,217,122,${blink.toFixed(2)})`;
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('Click or press Space to play again', 640, 580);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5,10,8,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('PAUSED', 640, 360);
  ctx.font = '22px Georgia, serif';
  ctx.fillText('Press P or Space to resume', 640, 430);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state, screen, best, hoverIndex = -1) {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      if (screen === SCREEN_TITLE) drawTitle(ctx, state, best);
      else if (screen === SCREEN_OVER) drawOver(ctx, state, best);
      else {
        drawTable(ctx, state, screen === SCREEN_PLAY ? hoverIndex : -1);
        if (screen === SCREEN_PAUSED) drawPaused(ctx);
      }
    },
  };
}

// Referenced by shots.js so the dossier outline names the live entry point.
export { effectiveValue };
