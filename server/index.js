import { WebSocketServer } from "ws";

const PORT = 8081;
const wss = new WebSocketServer({ port: PORT });

console.log(`Server listening on ws://localhost:${PORT}`);

// --- game constants ---
const TICK_HZ = 30;
const SNAPSHOT_HZ = 15;
const DT = 1 / TICK_HZ;

const WORLD = { w: 4000, h: 4000 };
const BASE_SPEED = 300; // units/sec

// --- state ---
/** @type {Map<string, any>} */
const players = new Map();

// Utility: random spawn
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function makePlayer(id) {
  return {
    id,
    x: rand(200, WORLD.w - 200),
    y: rand(200, WORLD.h - 200),
    vx: 0,
    vy: 0,
    // last received input
    input: { up: false, down: false, left: false, right: false },
    // cosmetic for now
    color: ["#6cc644", "#ff6b6b", "#ffd93d", "#4dabf7"][Math.floor(Math.random() * 4)],
    r: 18
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function normalize(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { nx: 0, ny: 0 };
  return { nx: dx / len, ny: dy / len };
}

function stepPlayer(p) {
  // Convert input -> desired direction
  let dx = 0, dy = 0;
  if (p.input.up) dy -= 1;
  if (p.input.down) dy += 1;
  if (p.input.left) dx -= 1;
  if (p.input.right) dx += 1;

  const { nx, ny } = normalize(dx, dy);

  // Simple movement: velocity = direction * speed
  p.vx = nx * BASE_SPEED;
  p.vy = ny * BASE_SPEED;

  p.x += p.vx * DT;
  p.y += p.vy * DT;

  // Keep in bounds
  p.x = clamp(p.x, p.r, WORLD.w - p.r);
  p.y = clamp(p.y, p.r, WORLD.h - p.r);
}

// --- networking helpers ---
function send(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

// --- connection handling ---
let nextId = 1;

wss.on("connection", (ws) => {
  const id = String(nextId++);
  const player = makePlayer(id);
  players.set(id, player);

  // Tell this client their id + world size
  send(ws, { type: "welcome", id, world: WORLD });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Client sends input updates
    if (msg.type === "input" && typeof msg.id === "string") {
      const p = players.get(msg.id);
      if (!p) return;

      // Basic validation: only accept booleans
      const inp = msg.input || {};
      p.input = {
        up: !!inp.up,
        down: !!inp.down,
        left: !!inp.left,
        right: !!inp.right
      };
    }
  });

  ws.on("close", () => {
    players.delete(id);
  });
});

// --- game loop ---
setInterval(() => {
  for (const p of players.values()) stepPlayer(p);
}, 1000 / TICK_HZ);

// Snapshot loop
setInterval(() => {
  const snapshot = {
    type: "snapshot",
    t: Date.now(),
    players: Array.from(players.values()).map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      r: p.r,
      color: p.color
    }))
  };
  broadcast(snapshot);
}, 1000 / SNAPSHOT_HZ);
