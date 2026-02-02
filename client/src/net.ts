import type { InputState, ServerMsg, SnapshotMsg, WelcomeMsg, World } from "./types";

export type NetState = {
  id: string | null;
  world: World | null;
  latestSnapshot: SnapshotMsg | null;
  connected: boolean;
};

export function connectNet(url: string) {
  const ws = new WebSocket(url);

  const net: NetState = {
    id: null,
    world: null,
    latestSnapshot: null,
    connected: false
  };

  ws.addEventListener("open", () => {
    net.connected = true;
  });

  ws.addEventListener("close", () => {
    net.connected = false;
  });

  ws.addEventListener("message", (ev) => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg.type === "welcome") {
      const w = msg as WelcomeMsg;
      net.id = w.id;
      net.world = w.world;
    } else if (msg.type === "snapshot") {
      net.latestSnapshot = msg as SnapshotMsg;
    }
  });

  function sendInput(id: string, input: InputState) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "input", id, input }));
  }

  return { net, sendInput };
}
