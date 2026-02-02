import type { InputState } from "./types";

export function makeInput(): { state: InputState; attach: () => void } {
  const state: InputState = { up: false, down: false, left: false, right: false };

  function setKey(e: KeyboardEvent, isDown: boolean) {
    const k = e.key.toLowerCase();
    if (k === "w" || k === "arrowup") state.up = isDown;
    if (k === "s" || k === "arrowdown") state.down = isDown;
    if (k === "a" || k === "arrowleft") state.left = isDown;
    if (k === "d" || k === "arrowright") state.right = isDown;
  }

  function attach() {
    window.addEventListener("keydown", (e) => setKey(e, true));
    window.addEventListener("keyup", (e) => setKey(e, false));
  }

  return { state, attach };
}
