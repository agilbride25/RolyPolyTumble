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

// Health / combat
const MAX_HP = 100;
const SPIDER_DAMAGE = 25;
const INVULN_TICKS = 12; // short invulnerability after taking damage (~0.4s at 30hz)
const RESPAWN_SECONDS = 3;
const RESPAWN_TICKS = Math.floor(RESPAWN_SECONDS * TICK_HZ);

// --- state ---
/** @type {Map<string, any>} */
const players = new Map();

// Spiders: simple NPC enemies
/** @type {Map<string, any>} */
const spiders = new Map();

const SPIDER_COUNT = 10;
const SPIDER_SPEED = 120; // units/sec
// spiders are larger now
const SPIDER_R = 14 * 4;
const SPIDER_BASE_HP = 200;
const AGGRO_RADIUS = 350;

// Player class stats: health, defense (flat), damage (for future use)
const CLASS_STATS = {
  cricket: { health: 90, defense: 2, damage: 8 },
  beetle: { health: 140, defense: 6, damage: 10 },
  firefly: { health: 80, defense: 1, damage: 6 },
  ladybug: { health: 110, defense: 3, damage: 9 }
};

// Leaves / XP
const LEAF_COUNT = 80;
const LEAF_R = 12;

// Different leaf rarities/types with varying XP rewards
const LEAF_TYPES = [
  { type: "yellow", xp: 5, weight: 60 },
  { type: "orange", xp: 12, weight: 30 },
  { type: "red", xp: 25, weight: 10 }
];

function chooseLeafType() {
  const total = LEAF_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of LEAF_TYPES) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return LEAF_TYPES[0];
}

function makeLeaf(id) {
  const spec = chooseLeafType();
  return {
    id,
    x: rand(50, WORLD.w - 50),
    y: rand(50, WORLD.h - 50),
    r: LEAF_R,
    type: spec.type,
    xp: spec.xp
  };
}

// Leaf collection helper
const leaves = new Map();
for (let i = 0; i < LEAF_COUNT; i++) {
  const id = `l${i + 1}`;
  leaves.set(id, makeLeaf(id));
}

function computeLevel(xp) {
  // Level grows logarithmically with XP. Tweak LOG_SCALE to adjust pace.
  const LOG_SCALE = 0.5;
  return Math.max(1, Math.floor(Math.log(xp + 1) * LOG_SCALE) + 1);
}

function makeSpider(id) {
  return {
    id,
    x: rand(200, WORLD.w - 200),
    y: rand(200, WORLD.h - 200),
    vx: 0,
    vy: 0,
    r: SPIDER_R,
    hp: SPIDER_BASE_HP,
    maxHp: SPIDER_BASE_HP,
    // simple wander state
    wanderDir: { x: Math.cos(Math.random() * Math.PI * 2), y: Math.sin(Math.random() * Math.PI * 2) },
    wanderTimer: Math.floor(Math.random() * 60)
  };
}

// spawn initial spiders
for (let i = 0; i < SPIDER_COUNT; i++) {
  const id = `s${i + 1}`;
  spiders.set(id, makeSpider(id));
}

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
    r: 18,
    facing: 0,
    // combat
    hp: MAX_HP,
    maxHp: MAX_HP,
    alive: true,
    invuln: 0,
    respawnTimer: 0,
    attackCooldown: 0,
    // progression
    xp: 0,
    level: 1
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

// Spider AI step
function stepSpider(s) {
  // Find nearest player
  let target = null;
  let bestDist = Infinity;
  for (const p of players.values()) {
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      target = p;
    }
  }

  if (target && bestDist <= AGGRO_RADIUS) {
    // Aggro: chase the player
    const { nx, ny } = normalize(target.x - s.x, target.y - s.y);
    s.vx = nx * SPIDER_SPEED;
    s.vy = ny * SPIDER_SPEED;
  } else {
    // Wander
    if (s.wanderTimer <= 0) {
      s.wanderDir = { x: Math.cos(Math.random() * Math.PI * 2), y: Math.sin(Math.random() * Math.PI * 2) };
      s.wanderTimer = 60 + Math.floor(Math.random() * 120);
    }
    s.wanderTimer -= 1;
    s.vx = s.wanderDir.x * (SPIDER_SPEED * 0.4);
    s.vy = s.wanderDir.y * (SPIDER_SPEED * 0.4);
  }

  s.x += s.vx * DT;
  s.y += s.vy * DT;

  // Keep in bounds
  s.x = clamp(s.x, s.r, WORLD.w - s.r);
  s.y = clamp(s.y, s.r, WORLD.h - s.r);
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
      // facing angle if provided
      if (typeof inp.facing === "number" && Number.isFinite(inp.facing)) {
        p.facing = inp.facing;
      }
    }

    // Client sets username / class
    if (msg.type === "join" && typeof msg.id === "string") {
      const p = players.get(msg.id);
      if (!p) return;
      // sanitize
      const name = typeof msg.username === "string" ? msg.username.substring(0, 20) : "";
      const cls = typeof msg.cls === "string" ? msg.cls : "";
      p.name = name;
      p.cls = cls;
      // apply class stats if known
      const stats = CLASS_STATS[cls] || null;
      if (stats) {
        p.maxHp = stats.health;
        p.hp = stats.health;
        p.defense = stats.defense;
        p.damage = stats.damage;
        // double player size for class sprite
        p.r = (p.r || 18) * 2;
      }
    }

    // Client attack request
    if (msg.type === "attack" && typeof msg.id === "string") {
      const p = players.get(msg.id);
      if (!p || !p.alive) return;
      // cooldown enforcement
      if (p.attackCooldown && p.attackCooldown > 0) return;
      // configure attack
      const ATTACK_RANGE = SPIDER_R * 1.8; // larger than spider radius
      const ATTACK_DAMAGE = 25; // fixed damage for mouse/left-click attacks
      // mark cooldown (ticks)
      const ATTACK_COOLDOWN_TICKS = Math.floor(0.6 * TICK_HZ);
      p.attackCooldown = ATTACK_COOLDOWN_TICKS;

      // directional arc check: only spiders within a cone centered on p.facing are hit
      const ANGLE_ARC = Math.PI / 3; // 60 degrees cone

      // find spiders in range and apply damage
      for (const s of spiders.values()) {
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d <= ATTACK_RANGE + s.r) {
          // compute angle to spider and compare to player's facing
          const angToSpider = Math.atan2(dy, dx);
          // normalize angle difference to [-PI,PI]
          let diff = angToSpider - (p.facing || 0);
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) > ANGLE_ARC / 2) continue; // outside cone
          s.hp -= ATTACK_DAMAGE;
          if (s.hp <= 0) {
            // reward player XP
            p.xp = (p.xp || 0) + 100;
            p.level = computeLevel(p.xp);
            // respawn spider at new location with full health
            s.x = rand(200, WORLD.w - 200);
            s.y = rand(200, WORLD.h - 200);
            s.vx = 0;
            s.vy = 0;
            s.hp = s.maxHp;
            s.wanderTimer = Math.floor(Math.random() * 60);
          }
        }
      }
    }
  });

  ws.on("close", () => {
    players.delete(id);
  });
});

// --- game loop ---
setInterval(() => {
  for (const p of players.values()) {
    // update invulnerability timer
    if (p.invuln > 0) p.invuln -= 1;
    if (p.attackCooldown > 0) p.attackCooldown -= 1;

    // handle death / respawn timers
    if (!p.alive) {
      if (p.respawnTimer > 0) {
        p.respawnTimer -= 1;
        if (p.respawnTimer <= 0) {
          // respawn the player
          p.alive = true;
          p.hp = p.maxHp;
          p.x = rand(200, WORLD.w - 200);
          p.y = rand(200, WORLD.h - 200);
          p.vx = 0;
          p.vy = 0;
          p.invuln = INVULN_TICKS; // short invuln after respawn
        }
      }
    } else {
      stepPlayer(p);
    }
  }

  for (const s of spiders.values()) stepSpider(s);

  // Leaf collection: players pick up leaves when overlapping
  for (const p of players.values()) {
    if (!p.alive) continue;
    for (const [lid, leaf] of leaves.entries()) {
      const dx = p.x - leaf.x;
      const dy = p.y - leaf.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < p.r + leaf.r) {
        // collect
        const gain = (leaf.xp || 0);
        p.xp = (p.xp || 0) + gain;
        p.level = computeLevel(p.xp);
        // remove and respawn leaf at new location
        leaves.delete(lid);
        const newId = `l${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        leaves.set(newId, makeLeaf(newId));
        break; // only collect one leaf per tick per player
      }
    }
  }

  // Simple interaction: if spider overlaps a player, damage and push the player back a bit
  for (const s of spiders.values()) {
    for (const p of players.values()) {
      if (!p.alive) continue;
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < p.r + s.r + 2) {
        // apply damage if not invulnerable
        if (!p.invuln || p.invuln <= 0) {
          // account for player defense (flat reduction)
          const def = p.defense || 0;
          const dmg = Math.max(1, SPIDER_DAMAGE - def);
          p.hp -= dmg;
          p.invuln = INVULN_TICKS;
          // kill
          if (p.hp <= 0) {
            p.alive = false;
            p.respawnTimer = RESPAWN_TICKS;
            // zero velocity while dead
            p.vx = 0;
            p.vy = 0;
            continue;
          }
        }

        // push player away from spider
        const { nx, ny } = normalize(dx, dy);
        const push = 40; // units to push
        p.x += nx * push;
        p.y += ny * push;
        // clamp after push
        p.x = clamp(p.x, p.r, WORLD.w - p.r);
        p.y = clamp(p.y, p.r, WORLD.h - p.r);
      }
    }
  }
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
      color: p.color,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: !!p.alive,
      respawnTimer: p.respawnTimer, // ticks remaining
      invuln: p.invuln || 0,
      attackCooldown: p.attackCooldown || 0,
      defense: p.defense || 0,
      damage: p.damage || 0,
      name: p.name || null,
      cls: p.cls || null,
      xp: p.xp || 0,
      level: p.level || 1,
      facing: p.facing || 0
    })),
    spiders: Array.from(spiders.values()).map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      r: s.r,
      hp: s.hp,
      maxHp: s.maxHp
    })),
    leaves: Array.from(leaves.values()).map((l) => ({ id: l.id, x: l.x, y: l.y, r: l.r, type: l.type, xp: l.xp }))
  };
  broadcast(snapshot);
}, 1000 / SNAPSHOT_HZ);
