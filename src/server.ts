import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  isPlatform,
  PROTOCOL_VERSION,
  type CreateRoomRequest,
  type Encounter,
  type JoinRoomRequest,
  type PlayerState,
  type PublishStateRequest,
  type Room,
  type Session,
  type SessionResponse,
} from "./protocol.js";

const port = Number(process.env.PORT ?? 8787);
const sessionTtlMs = Math.max(1000, Number(process.env.OPENLINK_SESSION_TTL_MS ?? 15 * 60 * 1000));
const rooms = new Map<string, Room>();
const roomStates = new Map<string, Map<string, PlayerState>>();
const liveConnections = new Map<string, Map<string, WebSocket>>();
const sessions = new Map<string, Session & { readonly token: string }>();
const encounters = new Map<string, Encounter[]>();
const encounterTtlMs = Math.max(1000, Number(process.env.OPENLINK_ENCOUNTER_TTL_MS ?? 24 * 60 * 60 * 1000));

const getSession = (token: string): (Session & { readonly token: string }) | undefined => {
  const session = sessions.get(token);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return session;
};

const sendJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) {
      throw new Error("request_too_large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const error = (response: ServerResponse, statusCode: number, code: string): void => {
  sendJson(response, statusCode, { error: code, protocolVersion: PROTOCOL_VERSION });
};

const handleCreateRoom = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = (await readJson(request)) as CreateRoomRequest;
  const name = typeof body.name === "string" && body.name.trim().length > 0
    ? body.name.trim().slice(0, 40)
    : "OpenLink room";
  const maxPlayers = typeof body.maxPlayers === "number" && Number.isInteger(body.maxPlayers)
    ? body.maxPlayers
    : 2;

  if (maxPlayers < 2 || maxPlayers > 16) {
    error(response, 400, "invalid_max_players");
    return;
  }

  const room: Room = {
    id: randomUUID(),
    name,
    maxPlayers,
    createdAt: new Date().toISOString(),
    players: [],
  };
  rooms.set(room.id, room);
  roomStates.set(room.id, new Map());
  liveConnections.set(room.id, new Map());
  sendJson(response, 201, room);
};

const handleCreateSession = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await readJson(request) as { readonly displayName?: unknown; readonly platform?: unknown };
  const displayName = typeof body.displayName === "string" && body.displayName.trim().length > 0
    ? body.displayName.trim().slice(0, 24)
    : undefined;
  if (!displayName || !isPlatform(body.platform) || body.platform === "desktop") {
    error(response, 400, "invalid_session");
    return;
  }

  const session: Session = {
    id: randomUUID(),
    displayName,
    platform: body.platform,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
  };
  const token = randomUUID();
  sessions.set(token, { ...session, token });
  const result: SessionResponse = {
    protocolVersion: PROTOCOL_VERSION,
    session,
    token,
  };
  sendJson(response, 201, result);
};

const handleRefreshSession = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await readJson(request) as { readonly token?: unknown };
  const oldToken = typeof body.token === "string" ? body.token : undefined;
  const current = oldToken ? getSession(oldToken) : undefined;
  if (!oldToken || !current) {
    error(response, 401, "invalid_session");
    return;
  }

  const session: Session = {
    id: current.id,
    displayName: current.displayName,
    platform: current.platform,
    createdAt: current.createdAt,
    expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
  };
  const token = randomUUID();
  sessions.delete(oldToken);
  sessions.set(token, { ...session, token });
  const result: SessionResponse = {
    protocolVersion: PROTOCOL_VERSION,
    session,
    token,
  };
  sendJson(response, 200, result);
};

const isGameId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_.-]{1,32}$/.test(value);

const isBase64 = (value: unknown): value is string =>
  typeof value === "string" && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);

const getSessionFromBody = async (request: IncomingMessage): Promise<{ token: string; body: Record<string, unknown> } | undefined> => {
  const body = await readJson(request) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token : undefined;
  return token && getSession(token) ? { token, body } : undefined;
};

const handlePublishEncounter = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const authenticated = await getSessionFromBody(request);
  if (!authenticated || !isGameId(authenticated.body.gameId) || !isBase64(authenticated.body.payload)) {
    error(response, 400, authenticated ? "invalid_encounter" : "invalid_session");
    return;
  }
  const payload = Buffer.from(authenticated.body.payload, "base64");
  if (payload.length > 512) {
    error(response, 413, "encounter_payload_too_large");
    return;
  }

  const now = new Date();
  const encounter: Encounter = {
    id: randomUUID(),
    gameId: authenticated.body.gameId,
    payload: authenticated.body.payload,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + encounterTtlMs).toISOString(),
  };
  const queue = encounters.get(encounter.gameId) ?? [];
  queue.push(encounter);
  encounters.set(encounter.gameId, queue);
  sendJson(response, 201, { protocolVersion: PROTOCOL_VERSION, encounter });
};

const handleConsumeEncounters = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const authenticated = await getSessionFromBody(request);
  if (!authenticated || !isGameId(authenticated.body.gameId)) {
    error(response, 400, authenticated ? "invalid_encounter" : "invalid_session");
    return;
  }

  const gameId = authenticated.body.gameId;
  const now = Date.now();
  const queue = encounters.get(gameId) ?? [];
  const available = queue.filter((encounter) => Date.parse(encounter.expiresAt) > now);
  encounters.delete(gameId);
  sendJson(response, 200, { protocolVersion: PROTOCOL_VERSION, encounters: available });
};

const handleJoinRoom = async (
  request: IncomingMessage,
  response: ServerResponse,
  roomId: string,
): Promise<void> => {
  const room = rooms.get(roomId);
  if (!room) {
    error(response, 404, "room_not_found");
    return;
  }
  if (room.players.length >= room.maxPlayers) {
    error(response, 409, "room_full");
    return;
  }

  const body = (await readJson(request)) as JoinRoomRequest;
  const displayName = typeof body.displayName === "string" && body.displayName.trim().length > 0
    ? body.displayName.trim().slice(0, 24)
    : "Player";
  if (!isPlatform(body.platform)) {
    error(response, 400, "invalid_platform");
    return;
  }

  const player = {
    id: randomUUID(),
    displayName,
    platform: body.platform,
    joinedAt: new Date().toISOString(),
  } as const;
  room.players.push(player);
  sendJson(response, 201, { room, player });
};

const handlePublishState = async (
  request: IncomingMessage,
  response: ServerResponse,
  roomId: string,
): Promise<void> => {
  const room = rooms.get(roomId);
  if (!room) {
    error(response, 404, "room_not_found");
    return;
  }

  const body = (await readJson(request)) as PublishStateRequest;
  const playerId = typeof body.playerId === "string" ? body.playerId : undefined;
  const player = room.players.find((candidate) => candidate.id === playerId);
  const x = typeof body.x === "number" && Number.isFinite(body.x) ? body.x : undefined;
  const y = typeof body.y === "number" && Number.isFinite(body.y) ? body.y : undefined;
  const sequence = typeof body.sequence === "number" && Number.isInteger(body.sequence) && body.sequence >= 0
    ? body.sequence
    : undefined;
  const buttons = Array.isArray(body.buttons) && body.buttons.every((button) => typeof button === "string")
    ? body.buttons.slice(0, 8) as string[]
    : undefined;

  if (!player || x === undefined || y === undefined || sequence === undefined || !buttons) {
    error(response, 400, "invalid_player_state");
    return;
  }

  const states = roomStates.get(roomId);
  if (!states) {
    error(response, 500, "room_state_unavailable");
    return;
  }

  const previous = states.get(player.id);
  if (previous && sequence <= previous.sequence) {
    error(response, 409, "stale_player_state");
    return;
  }

  const state: PlayerState = {
    playerId: player.id,
    x,
    y,
    buttons,
    sequence,
    sentAt: new Date().toISOString(),
  };
  states.set(player.id, state);
  sendJson(response, 202, { protocolVersion: PROTOCOL_VERSION, state });
};

const handleListState = (response: ServerResponse, roomId: string): void => {
  if (!rooms.has(roomId)) {
    error(response, 404, "room_not_found");
    return;
  }

  const states = roomStates.get(roomId) ?? new Map<string, PlayerState>();
  sendJson(response, 200, { protocolVersion: PROTOCOL_VERSION, states: [...states.values()] });
};

const sendSocket = (socket: WebSocket, message: unknown): void => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcastSocket = (roomId: string, message: unknown, except?: WebSocket): void => {
  const connections = liveConnections.get(roomId);
  if (!connections) {
    return;
  }
  for (const socket of connections.values()) {
    if (socket !== except) {
      sendSocket(socket, message);
    }
  }
};

const handleLiveConnection = (socket: WebSocket, roomId: string): void => {
  const room = rooms.get(roomId);
  const connections = liveConnections.get(roomId);
  if (!room || !connections) {
    sendSocket(socket, { type: "error", error: "room_not_found" });
    socket.close(1008, "room_not_found");
    return;
  }

  let playerId: string | undefined;
  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;

      if (message.type === "join") {
        if (playerId) {
          sendSocket(socket, { type: "error", error: "already_joined" });
          return;
        }
        const token = typeof message.token === "string" ? message.token : undefined;
        const session = token ? getSession(token) : undefined;
        if (!session) {
          sendSocket(socket, { type: "error", error: "invalid_session" });
          return;
        }
        if (room.players.length >= room.maxPlayers) {
          sendSocket(socket, { type: "error", error: "room_full" });
          return;
        }

        const player = {
          id: randomUUID(),
          displayName: session.displayName,
          platform: session.platform,
          joinedAt: new Date().toISOString(),
        } as const;
        room.players.push(player);
        playerId = player.id;
        connections.set(player.id, socket);
        sendSocket(socket, { type: "joined", protocolVersion: PROTOCOL_VERSION, room, player });
        broadcastSocket(roomId, { type: "player_joined", player }, socket);
        return;
      }

      if (message.type === "state") {
        if (!playerId) {
          sendSocket(socket, { type: "error", error: "join_required" });
          return;
        }
        const x = typeof message.x === "number" && Number.isFinite(message.x) ? message.x : undefined;
        const y = typeof message.y === "number" && Number.isFinite(message.y) ? message.y : undefined;
        const sequence = typeof message.sequence === "number" && Number.isInteger(message.sequence) && message.sequence >= 0
          ? message.sequence
          : undefined;
        const buttons = Array.isArray(message.buttons) && message.buttons.every((button) => typeof button === "string")
          ? message.buttons.slice(0, 8) as string[]
          : undefined;
        const states = roomStates.get(roomId);
        const previous = states?.get(playerId);
        if (x === undefined || y === undefined || sequence === undefined || !buttons || !states) {
          sendSocket(socket, { type: "error", error: "invalid_player_state" });
          return;
        }
        if (previous && sequence <= previous.sequence) {
          sendSocket(socket, { type: "error", error: "stale_player_state" });
          return;
        }
        const state: PlayerState = {
          playerId,
          x,
          y,
          buttons,
          sequence,
          sentAt: new Date().toISOString(),
        };
        states.set(playerId, state);
        broadcastSocket(roomId, { type: "state", state });
        return;
      }

      sendSocket(socket, { type: "error", error: "unknown_message" });
    } catch {
      sendSocket(socket, { type: "error", error: "invalid_json" });
    }
  });

  socket.on("close", () => {
    if (!playerId) {
      return;
    }
    connections.delete(playerId);
    roomStates.get(roomId)?.delete(playerId);
    const playerIndex = room.players.findIndex((player) => player.id === playerId);
    if (playerIndex >= 0) {
      const [player] = room.players.splice(playerIndex, 1);
      if (player) {
        broadcastSocket(roomId, { type: "player_left", playerId: player.id });
      }
    }
  });
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", protocolVersion: PROTOCOL_VERSION });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/rooms") {
      sendJson(response, 200, { protocolVersion: PROTOCOL_VERSION, rooms: [...rooms.values()] });
      return;
    }

    if (method === "POST" && url.pathname === "/v1/rooms") {
      await handleCreateRoom(request, response);
      return;
    }

    if (method === "POST" && url.pathname === "/v1/sessions") {
      await handleCreateSession(request, response);
      return;
    }

    if (method === "POST" && url.pathname === "/v1/sessions/refresh") {
      await handleRefreshSession(request, response);
      return;
    }

    if (method === "POST" && url.pathname === "/v1/encounters") {
      await handlePublishEncounter(request, response);
      return;
    }

    if (method === "POST" && url.pathname === "/v1/encounters/consume") {
      await handleConsumeEncounters(request, response);
      return;
    }

      if (method === "POST" && parts.length === 4 && parts[0] === "v1" && parts[1] === "rooms" && parts[2] && parts[3] === "players") {
      await handleJoinRoom(request, response, parts[2]);
      return;
    }

      if (method === "POST" && parts.length === 4 && parts[0] === "v1" && parts[1] === "rooms" && parts[2] && parts[3] === "state") {
        await handlePublishState(request, response, parts[2]);
        return;
      }

      if (method === "GET" && parts.length === 4 && parts[0] === "v1" && parts[1] === "rooms" && parts[2] && parts[3] === "state") {
        handleListState(response, parts[2]);
        return;
      }

    error(response, 404, "route_not_found");
  } catch (requestError) {
    const code = requestError instanceof SyntaxError ? "invalid_json" : "request_failed";
    error(response, 400, code);
  }
};

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

const webSocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const roomId = parts[2];
  if (parts.length !== 4 || parts[0] !== "v1" || parts[1] !== "rooms" || !roomId || parts[3] !== "live") {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    handleLiveConnection(client, roomId);
  });
});

server.listen(port, () => {
  console.log(`OpenLink server listening on http://localhost:${port}`);
});
