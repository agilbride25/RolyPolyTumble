import { makeInput } from "./input";
import { connectNet } from "./net";
import { renderFrame, resizeCanvas } from "./render";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;

let ctx = resizeCanvas(canvas).ctx;
window.addEventListener("resize", () => {
  ctx = resizeCanvas(canvas).ctx;
});

const { state: input, attach } = makeInput();
attach();

// connect to local server
const { net, sendInput } = connectNet("ws://localhost:8081");

// Send inputs at a steady rate (30/sec)
setInterval(() => {
  if (!net.id) return;
  sendInput(net.id, input);
}, 1000 / 30);

function loop() {
  const connected = net.connected ? "yes" : "no";
  const id = net.id ?? "(none)";
  const world = net.world;

  if (!net.latestSnapshot || !world || !net.id) {
    hud.textContent = `Connecting... connected=${connected} id=${id}`;
    requestAnimationFrame(loop);
    return;
  }

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
