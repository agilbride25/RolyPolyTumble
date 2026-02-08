import { makeInput } from "./input";
import { connectNet } from "./net";
import { renderFrame, resizeCanvas } from "./render";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const joinScreen = document.getElementById("join-screen") as HTMLDivElement | null;

let ctx = resizeCanvas(canvas).ctx;
window.addEventListener("resize", () => {
  ctx = resizeCanvas(canvas).ctx;
});

// join UI
let selectedClass: string | null = null;
if (joinScreen) {
  const usernameInput = document.getElementById("username") as HTMLInputElement;
  const classCards = Array.from(joinScreen.querySelectorAll(".class-card")) as HTMLDivElement[];
  const confirmBtn = document.getElementById("confirm-btn") as HTMLButtonElement;

  classCards.forEach((card) => {
    card.addEventListener("click", () => {
      classCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedClass = card.getAttribute("data-class");
      confirmBtn.disabled = !(selectedClass && usernameInput.value.trim().length > 0);
    });
  });

  usernameInput.addEventListener("input", () => {
    confirmBtn.disabled = !(selectedClass && usernameInput.value.trim().length > 0);
  });

  confirmBtn.addEventListener("click", () => {
    const username = (document.getElementById("username") as HTMLInputElement).value.trim();
    if (!username || !selectedClass) return;
    // send join info to server (if connected), else store on client and wait
    trySendJoin(username, selectedClass);
    if (joinScreen) joinScreen.style.display = "none";
  });
}

// store the pending join if server not open yet
let pendingJoin: { username: string; cls: string } | null = null;

function trySendJoin(username: string, cls: string) {
  pendingJoin = { username, cls };
  maybeSendPendingJoin();
}

// connect to local server
const { net, sendInput, sendJoin, sendAttack } = connectNet("ws://localhost:8081");

// send join when we get our client id (welcome message)
let hasSentJoinForId = new Set<string>();
function maybeSendPendingJoin() {
  if (!pendingJoin) return;
  if (!net.id) return;
  if (hasSentJoinForId.has(net.id)) return;
  sendJoin(net.id, pendingJoin.username, pendingJoin.cls);
  hasSentJoinForId.add(net.id);
}

// Note: join screen will be hidden when the user confirms; do not hide it on load
// (it was previously being hidden unconditionally). The confirm button handler hides it.

const { state: input, attach } = makeInput();
attach();

// Send inputs at a steady rate (30/sec)
setInterval(() => {
  if (!net.id) return;
  // compute facing angle based on mouse position relative to center of viewport
  const mouse = (window as any).__mouse || { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
  const center = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
  const dx = mouse.x - center.x;
  const dy = mouse.y - center.y;
  const facing = Math.atan2(dy, dx);
  // include facing in input payload
  sendInput(net.id, { ...input, facing });
}, 1000 / 30);

// Attack controls: Spacebar or left click
// track mouse position for local facing
(window as any).__mouse = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
canvas.addEventListener("mousemove", (e) => {
  (window as any).__mouse.x = e.clientX;
  (window as any).__mouse.y = e.clientY;
});
canvas.addEventListener("touchmove", (e) => {
  if (e.touches && e.touches.length > 0) {
    const t = e.touches[0];
    (window as any).__mouse.x = t.clientX;
    (window as any).__mouse.y = t.clientY;
  }
}, { passive: true });

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (net.id) sendAttack(net.id);
  }
});
window.addEventListener("mousedown", (e) => {
  // left click only
  if (e.button === 0 && net.id) sendAttack(net.id);
});

function loop() {
  const connected = net.connected ? "yes" : "no";
  const id = net.id ?? "(none)";
  const world = net.world;

  if (!net.latestSnapshot || !world || !net.id) {
    hud.textContent = `Connecting... connected=${connected} id=${id}`;
    requestAnimationFrame(loop);
    return;
  }

  // If we have a pending join and an assigned id, send it now
  maybeSendPendingJoin();

  hud.textContent = `connected=${connected} | you=Bug ${net.id} | players=${net.latestSnapshot.players.length} | WASD/Arrows to move`;

  renderFrame({
    ctx,
    canvas,
    world,
    meId: net.id,
    players: net.latestSnapshot.players,
    spiders: net.latestSnapshot.spiders || [],
    leaves: net.latestSnapshot.leaves || []
  });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
