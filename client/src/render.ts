import type { PlayerSnapshot, World, Spider, Leaf } from "./types";

let camSmoothX = 0;
let camSmoothY = 0;
let camInit = false;

// client-side displayed positions for smoothing
const displayPositions = new Map<string, { x: number; y: number }>();

// --- Forest background assets ---
let forestImg: HTMLImageElement | null = null;
let forestPattern: CanvasPattern | null = null;

// Leaf sprites
let yellowLeafImg: HTMLImageElement | null = null;
let orangeLeafImg: HTMLImageElement | null = null;
let redLeafImg: HTMLImageElement | null = null;

// Spider sprites
let spiderHappyImg: HTMLImageElement | null = null;
let spiderAngryImg: HTMLImageElement | null = null;

// Class icons
(window as any).__class_cricket_img = new Image();
(window as any).__class_cricket_img.src = "/assets/cricket_sprite_v1.png";
(window as any).__class_beetle_img = new Image();
(window as any).__class_beetle_img.src = "/assets/beetle_v1.png";
(window as any).__class_firefly_img = new Image();
(window as any).__class_firefly_img.src = "/assets/firefly_v1.png";
(window as any).__class_ladybug_img = new Image();
(window as any).__class_ladybug_img.src = "/assets/ladybug_v1.png";

function ensureLeafImagesLoaded() {
  if (!yellowLeafImg) {
    yellowLeafImg = new Image();
    yellowLeafImg.src = "/assets/yellow_maple.png";
  }
  if (!orangeLeafImg) {
    orangeLeafImg = new Image();
    orangeLeafImg.src = "/assets/orange_maple.png";
  }
  if (!redLeafImg) {
    redLeafImg = new Image();
    redLeafImg.src = "/assets/red_maple.png";
  }
  if (!spiderHappyImg) {
    spiderHappyImg = new Image();
    spiderHappyImg.src = "/assets/happy_spiderv1.png";
  }
  if (!spiderAngryImg) {
    spiderAngryImg = new Image();
    spiderAngryImg.src = "/assets/angry_spider.png";
  }
}

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
  ensureLeafImagesLoaded();
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

  // Fill outside world with neutral grey
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);

  // Draw forest background only inside the world bounds
  if (forestPattern && forestImg) {
    const worldScreenX = -camX;
    const worldScreenY = -camY;
    ctx.save();
    // clip to world rect in screen space
    ctx.beginPath();
    ctx.rect(worldScreenX, worldScreenY, world.w, world.h);
    ctx.clip();

    const tileW = forestImg.width || 256;
    const tileH = forestImg.height || 256;

    // JS % can be negative. Normalize to [0, tile)
    const mod = (n: number, m: number) => ((n % m) + m) % m;

    const offX = mod(camX, tileW);
    const offY = mod(camY, tileH);

    // anchor pattern to world space
    ctx.translate(-offX, -offY);

    ctx.fillStyle = forestPattern;

    // pad enough to cover world area after translate
    ctx.fillRect(worldScreenX - tileW, worldScreenY - tileH, world.w + tileW * 2, world.h + tileH * 2);

    ctx.restore();
  } else {
    // Fallback while image loads: draw the world area in green
    const wsx = -camX;
    const wsy = -camY;
    ctx.fillStyle = "#3a8f3a";
    ctx.fillRect(wsx, wsy, world.w, world.h);
  }

  // Simple grid (draw only inside world bounds)
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#23314d";
  ctx.lineWidth = 1;

  const grid = 100;
  const startX = Math.floor(camX / grid) * grid;
  const startY = Math.floor(camY / grid) * grid;

  const worldScreenLeft = -camX;
  const worldScreenTop = -camY;
  const worldScreenRight = worldScreenLeft + world.w;
  const worldScreenBottom = worldScreenTop + world.h;

  // Vertical lines
  for (let x = startX; x <= camX + w; x += grid) {
    const sx = x - camX;
    if (sx < 0 || sx > w) continue;
    const y0 = Math.max(0, worldScreenTop);
    const y1 = Math.min(h, worldScreenBottom);
    ctx.beginPath();
    ctx.moveTo(sx, y0);
    ctx.lineTo(sx, y1);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = startY; y <= camY + h; y += grid) {
    const sy = y - camY;
    if (sy < 0 || sy > h) continue;
    const x0 = Math.max(0, worldScreenLeft);
    const x1 = Math.min(w, worldScreenRight);
    ctx.beginPath();
    ctx.moveTo(x0, sy);
    ctx.lineTo(x1, sy);
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
      // choose image by leaf type
      let img: HTMLImageElement | null = null;
      if (l.type === "red") img = redLeafImg;
      else if (l.type === "orange") img = orangeLeafImg;
      else img = yellowLeafImg;

      const drawSize = l.r * 2.4; // scale image slightly larger than radius
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(0.15);
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
      } else {
        // fallback: colored circle depending on type
        ctx.fillStyle = l.type === "red" ? "#d44" : l.type === "orange" ? "#f39c12" : "#f7e26b";
        ctx.beginPath();
        ctx.ellipse(lx, ly, l.r * 1.2, l.r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // smoothing parameters
  const POS_PREDICT = 0.06; // seconds of client-side prediction based on velocity
  const POS_SMOOTH = 0.18; // 0..1, higher = snappier

  // Players
  for (const p of players) {
    // ensure a display position exists
    if (!displayPositions.has(p.id)) {
      displayPositions.set(p.id, { x: p.x, y: p.y });
    }
    const disp = displayPositions.get(p.id)!;

    // If player is dead, snap them to server position immediately
    if (p.alive === false) {
      disp.x = p.x;
      disp.y = p.y;
    } else {
      // target includes a small velocity-based prediction to smooth interpolation
      const targetX = p.x + (p.vx || 0) * POS_PREDICT;
      const targetY = p.y + (p.vy || 0) * POS_PREDICT;
      disp.x += (targetX - disp.x) * POS_SMOOTH;
      disp.y += (targetY - disp.y) * POS_SMOOTH;
    }

    const sx = disp.x - camX;
    const sy = disp.y - camY;

    // If player has a chosen class and sprite image is available, draw that sprite centered
    let drewSprite = false;
    if (p.cls) {
      let sprite: HTMLImageElement | null = null;
      if (p.cls === "cricket") sprite = (window as any).__class_cricket_img;
      else if (p.cls === "beetle") sprite = (window as any).__class_beetle_img;
      else if (p.cls === "firefly") sprite = (window as any).__class_firefly_img;
      else if (p.cls === "ladybug") sprite = (window as any).__class_ladybug_img;

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        // per-class sprite scale so cricket/firefly are slightly smaller than beetle/ladybug
        const CLASS_SPRITE_SCALE: Record<string, number> = { beetle: 2.4, ladybug: 2.4, cricket: 2.2, firefly: 2.2 };
        const scale = CLASS_SPRITE_SCALE[p.cls] ?? 2.2;
        const drawSize = p.r * scale;
        ctx.save();
        // subtle shadow
        ctx.globalAlpha = 0.95;
        // rotate local player's sprite toward mouse cursor
        if (p.id === meId) {
          const mouse = (window as any).__mouse || { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
          const dx = mouse.x - (sx);
          const dy = mouse.y - (sy);
          const ang = Math.atan2(dy, dx);
          ctx.translate(sx, sy);
          ctx.rotate(ang + Math.PI / 2); // adjust so sprite faces cursor appropriately
          ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        } else {
          ctx.drawImage(sprite, sx - drawSize / 2, sy - drawSize / 2, drawSize, drawSize);
        }
        ctx.restore();
        drewSprite = true;
      }
    }

    // fallback: colored circle
    if (!drewSprite) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();
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
    const displayName = p.name || `Bug ${p.id}`;
    ctx.fillText(`${displayName} ${levelLabel}`, sx, sy - p.r - 8);
  }

  // Spiders (NPCs)
  const AGGRO_RADIUS = 350; // match server
  for (const s of spiders) {
    const sx = s.x - camX;
    const sy = s.y - camY;

    // choose sprite based on distance to local player
    let useAngry = false;
    if (me) {
      const dx = me.x - s.x;
      const dy = me.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d <= AGGRO_RADIUS) useAngry = true;
    }

    const img = useAngry ? spiderAngryImg : spiderHappyImg;
    const drawSize = s.r * 3.0;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();
    } else {
      // fallback to circle if image not loaded
      ctx.fillStyle = useAngry ? "#8b1e1e" : s.color || "#3b2b2b";
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // optional label
    ctx.fillStyle = "#f0e8e0";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Spider ${s.id}`, sx, sy - s.r - 8);
  }

  // HUD: bottom-center (local player HP / XP / Level)
  if (me) {
    const LOG_SCALE = 0.5; // must match server computeLevel LOG_SCALE
    const hp = me.hp ?? 0;
    const maxHp = me.maxHp ?? 100;
    const xp = me.xp ?? 0;
    const level = me.level ?? Math.max(1, Math.floor(Math.log(xp + 1) * LOG_SCALE) + 1);

    const xpLower = Math.exp((level - 1) / LOG_SCALE) - 1;
    const xpUpper = Math.exp(level / LOG_SCALE) - 1;
    const xpPct = xpUpper > xpLower ? Math.max(0, Math.min(1, (xp - xpLower) / (xpUpper - xpLower))) : 0;

    const hudW = 320;
    const hudH = 60;
    const hx = Math.round(w / 2 - hudW / 2);
    const hyTop = Math.round(h - hudH - 18);

    // background panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(hx, hyTop, hudW, hudH);

    // HP bar
    const barW = hudW - 40;
    const hpPct = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = "#222";
    ctx.fillRect(hx + 20, hyTop + 10, barW, 14);
    ctx.fillStyle = "#e04a4a";
    ctx.fillRect(hx + 20, hyTop + 10, barW * hpPct, 14);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 20, hyTop + 10, barW, 14);

    // XP bar
    ctx.fillStyle = "#222";
    ctx.fillRect(hx + 20, hyTop + 30, barW, 8);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(hx + 20, hyTop + 30, barW * xpPct, 8);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(hx + 20, hyTop + 30, barW, 8);

    // Text
    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`HP ${Math.round(hp)}/${maxHp}`, hx + 24, hyTop + 22);
    ctx.textAlign = "right";
    ctx.fillText(`Lv ${level}`, hx + hudW - 18, hyTop + 22);
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(`${xp} XP`, hx + hudW - 18, hyTop + 46);
  }
}
