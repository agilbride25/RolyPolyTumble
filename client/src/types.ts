export type World = { w: number; h: number };

export type PlayerSnapshot = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
};

export type SnapshotMsg = {
  type: "snapshot";
  t: number;
  players: PlayerSnapshot[];
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
};
