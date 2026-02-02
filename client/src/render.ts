import type { PlayerSnapshot, World } from "./types";

export function resizeCanvas(canvas: HTMLCanvasElement) {
  // handle devicePixelRatio so it stays crisp
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx };
}

export function renderFrame(args: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  world: World;
  meId: string;
  players: PlayerSnapshot[];
}) {
  const { ctx, canvas, world, meId, players } = args;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  const me = players.find((p) => p.id === meId);

  // Camera centered on me
  const camX = me ? me.x - w / 2 : 0;
  const camY = me ? me.y - h / 2 : 0;

  // Background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h);

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

    // name/id label
    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Bug ${p.id}`, sx, sy - p.r - 8);
  }
}
