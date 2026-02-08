import type { PlayerSnapshot, World, Spider, Leaf } from "./types";

let camSmoothX = 0;
let camSmoothY = 0;
let camInit = false;


// --- Forest background assets ---
let forestImg: HTMLImageElement | null = null;
let forestPattern: CanvasPattern | null = null;

function ensureForestLoaded(ctx: CanvasRenderingContext2D) {
  if (!forestImg) {
    forestImg = new Image();
    forestImg.src = "/assets/rpt_forest_v1.png";
    forestImg.onload = () => {
      forestPattern = ctx.createPattern(forestImg!, "repeat");
    };
  }
}



export function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ensureForestLoaded(ctx);
  return { ctx };
}


export function renderFrame(args: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  world: World;
  meId: string;
  players: PlayerSnapshot[];
  spiders?: Spider[];
  leaves?: Leaf[];
}) {
  const { ctx, canvas, world, meId, players, spiders = [], leaves = [] } = args;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  const me = players.find((p) => p.id === meId);

  // Camera centered on me
const targetCamX = me ? me.x - w / 2 : 0;
const targetCamY = me ? me.y - h / 2 : 0;

// initialize on first frame so it doesn't "fly in"
if (!camInit) {
  camSmoothX = targetCamX;
  camSmoothY = targetCamY;
  camInit = true;
}

// smooth factor: higher = snappier, lower = floatier
const SMOOTH = 0.18;
camSmoothX += (targetCamX - camSmoothX) * SMOOTH;
camSmoothY += (targetCamY - camSmoothY) * SMOOTH;

const camX = camSmoothX;
const camY = camSmoothY;


  // Background
ctx.clearRect(0, 0, w, h);

// --- Forest background ---
if (forestPattern) {
// Background
ctx.clearRect(0, 0, w, h);

// --- Forest background ---
if (forestPattern && forestImg) {
  ctx.save();

  const tileW = forestImg.width || 256;
  const tileH = forestImg.height || 256;

  // JS % can be negative. Normalize to [0, tile)
  const mod = (n: number, m: number) => ((n % m) + m) % m;

  const offX = mod(camX, tileW);
  const offY = mod(camY, tileH);

  // anchor pattern to world space
  ctx.translate(-offX, -offY);

  ctx.fillStyle = forestPattern;

  // pad enough to cover after translate
  ctx.fillRect(-tileW, -tileH, w + tileW * 2, h + tileH * 2);

  ctx.restore();
} else {
  // Fallback while image loads
  ctx.fillStyle = "#3a8f3a";
  ctx.fillRect(0, 0, w, h);
}
}

  // Simple grid (world reference)
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#23314d";
  ctx.lineWidth = 1;

  const grid = 100;
  const startX = Math.floor(camX / grid) * grid;
  const startY = Math.floor(camY / grid) * grid;

  for (let x = startX; x < camX + w; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x - camX, 0);
    ctx.lineTo(x - camX, h);
    ctx.stroke();
  }
  for (let y = startY; y < camY + h; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y - camY);
    ctx.lineTo(w, y - camY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // World bounds
  ctx.strokeStyle = "#5a6b8a";
  ctx.lineWidth = 2;
  ctx.strokeRect(-camX, -camY, world.w, world.h);

  // Leaves (collectibles)
  if (leaves && Array.isArray(leaves)) {
    for (const l of leaves) {
      if (!l) continue;
      const lx = l.x - camX;
      const ly = l.y - camY;
      // draw a stylized leaf
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(0.4);
      ctx.fillStyle = "#7fcf4d";
      ctx.beginPath();
      ctx.ellipse(0, 0, l.r * 1.2, l.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5aa02a";
      ctx.beginPath();
      ctx.moveTo(0, -l.r * 0.1);
      ctx.lineTo(l.r * 0.9, 0);
      ctx.lineTo(0, l.r * 0.1);
      ctx.fill();
      ctx.restore();
    }
  }

  // Players
  for (const p of players) {
    const sx = p.x - camX;
    const sy = p.y - camY;

    // body
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
    ctx.fill();

    // outline for "me"
    if (p.id === meId) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // HP bar
    if (typeof p.hp === "number" && typeof p.maxHp === "number") {
      const barW = p.r * 2;
      const barH = 6;
      const pct = Math.max(0, Math.min(1, p.hp / p.maxHp));
      ctx.fillStyle = "#222a3a";
      ctx.fillRect(sx - barW / 2, sy + p.r + 6, barW, barH);
      ctx.fillStyle = "#a33";
      ctx.fillRect(sx - barW / 2 + 1, sy + p.r + 7, (barW - 2) * pct, barH - 2);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - barW / 2, sy + p.r + 6, barW, barH);
    }

    // dead overlay / respawn timer
    if (p.alive === false) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(sx, sy, p.r + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      const secs = p.respawnTimer ? Math.ceil(p.respawnTimer / 30) : 0;
      ctx.fillText(secs > 0 ? `Respawn ${secs}` : "Respawning...", sx, sy + 4);
    }

    // name/id and level label
    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    const levelLabel = typeof p.level === "number" ? `Lv ${p.level}` : "";
    ctx.fillText(`Bug ${p.id} ${levelLabel}`, sx, sy - p.r - 8);
  }

  // Spiders (NPCs)
  for (const s of spiders) {
    const sx = s.x - camX;
    const sy = s.y - camY;

    // body
    ctx.fillStyle = s.color || "#3b2b2b";
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();

    // simple eyes
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx - s.r * 0.35, sy - s.r * 0.25, s.r * 0.28, 0, Math.PI * 2);
    ctx.arc(sx + s.r * 0.35, sy - s.r * 0.25, s.r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(sx - s.r * 0.35, sy - s.r * 0.25, s.r * 0.12, 0, Math.PI * 2);
    ctx.arc(sx + s.r * 0.35, sy - s.r * 0.25, s.r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // optional label
    ctx.fillStyle = "#f0e8e0";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Spider ${s.id}`, sx, sy - s.r - 8);
  }
}
