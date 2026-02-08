export type World = { w: number; h: number };

export type PlayerSnapshot = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  hp?: number;
  maxHp?: number;
  alive?: boolean;
  respawnTimer?: number; // ticks remaining
  xp?: number;
  level?: number;
  name?: string | null;
  cls?: string | null;
  facing?: number;
  defense?: number;
  damage?: number;
};

export type SnapshotMsg = {
  type: "snapshot";
  t: number;
  players: PlayerSnapshot[];
  spiders?: Spider[];
  leaves?: Leaf[];
};

export type WelcomeMsg = {
  type: "welcome";
  id: string;
  world: World;
};

export type ServerMsg = WelcomeMsg | SnapshotMsg;

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  facing?: number;
};

export type Spider = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color?: string;
  hp?: number;
  maxHp?: number;
};

export type Leaf = {
  id: string;
  x: number;
  y: number;
  r: number;
  type?: "yellow" | "orange" | "red";
  xp?: number;
};