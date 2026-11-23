// Four Winds: input. One job: turn mouse and keyboard into actions the
// main loop can read once per frame — no game logic lives here.
export const ACTION_NONE = 0;
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  let actions = ACTION_NONE;
  let numberKey = -1;
  let clicked = false;
  const mouse = { x: 0, y: 0 };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const p = canvasPoint(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });

  canvas.addEventListener('pointerdown', (event) => {
    const p = canvasPoint(event);
    mouse.x = p.x;
    mouse.y = p.y;
    clicked = true;
    actions |= ACTION_CONFIRM;
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code.startsWith('Digit')) {
      const n = Number(event.code.slice(5));
      if (n >= 1 && n <= 5) numberKey = n - 1;
    }
  });

  return {
    mouse,
    /** Actions queued since the last read (confirm / pause). */
    takeActions() {
      const queued = actions;
      actions = ACTION_NONE;
      return queued;
    },
    /** A queued 1-5 card pick, or -1. */
    takeNumber() {
      const n = numberKey;
      numberKey = -1;
      return n;
    },
    /** Whether the canvas was clicked since the last read. */
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
  };
}
