import { WebSocket } from "ws";

interface Room {
  readonly id: string;
}

interface SessionResponse {
  readonly token: string;
}

interface JoinedMessage {
  readonly type: "joined";
  readonly player: { readonly id: string };
}

interface StateMessage {
  readonly type: "state";
  readonly state: {
    readonly playerId: string;
    readonly sequence: number;
  };
}

const baseUrl = process.env.OPENLINK_URL ?? "http://localhost:8787";
const socketUrl = baseUrl.replace(/^http/, "ws");

const createRoom = async (): Promise<Room> => {
  const response = await fetch(`${baseUrl}/v1/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "WebSocket reference", maxPlayers: 2 }),
  });
  return response.json() as Promise<Room>;
};

const createSession = async (displayName: string, platform: "3ds" | "switch"): Promise<SessionResponse> => {
  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName, platform }),
  });
  return response.json() as Promise<SessionResponse>;
};

const refreshSession = async (token: string): Promise<SessionResponse> => {
  const response = await fetch(`${baseUrl}/v1/sessions/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return response.json() as Promise<SessionResponse>;
};

const connect = (roomId: string, token: string): Promise<{ socket: WebSocket; playerId: string }> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`${socketUrl}/v1/rooms/${roomId}/live`);
    socket.once("error", reject);
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as JoinedMessage;
      if (message.type === "joined") {
        resolve({ socket, playerId: message.player.id });
      }
    });
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "join", token }));
    });
  });

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const run = async (): Promise<void> => {
  const room = await createRoom();
  const threeDsSession = await createSession("3DS live", "3ds");
  const switchSession = await createSession("Switch live", "switch");
  const refreshedThreeDsSession = await refreshSession(threeDsSession.token);
  const staleRefresh = await fetch(`${baseUrl}/v1/sessions/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: threeDsSession.token }),
  });
  if (staleRefresh.status !== 401) {
    throw new Error(`expected rotated token to be rejected, received ${staleRefresh.status}`);
  }
  const threeDs = await connect(room.id, refreshedThreeDsSession.token);
  const switchPlayer = await connect(room.id, switchSession.token);
  let receivedStates = 0;

  const countState = (data: Buffer): void => {
    const message = JSON.parse(data.toString()) as StateMessage;
    if (message.type === "state") {
      receivedStates += 1;
    }
  };
  threeDs.socket.on("message", countState);
  switchPlayer.socket.on("message", countState);

  for (let sequence = 1; sequence <= 3; sequence += 1) {
    threeDs.socket.send(JSON.stringify({ type: "state", x: sequence, y: 1, buttons: [], sequence }));
    switchPlayer.socket.send(JSON.stringify({ type: "state", x: 10 - sequence, y: 4, buttons: [], sequence }));
    await wait(50);
  }

  threeDs.socket.close();
  switchPlayer.socket.close();
  if (receivedStates !== 12) {
    throw new Error(`expected 12 relayed states, received ${receivedStates}`);
  }
  console.log(`WebSocket demo completed: ${receivedStates} states relayed between 3DS and Switch clients.`);
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
