interface Room {
  readonly id: string;
  readonly name: string;
}

interface JoinedPlayer {
  readonly player: {
    readonly id: string;
    readonly displayName: string;
  };
}

interface PlayerState {
  readonly playerId: string;
  readonly x: number;
  readonly y: number;
  readonly buttons: string[];
  readonly sequence: number;
}

interface StateResponse {
  readonly states: PlayerState[];
}

const baseUrl = process.env.OPENLINK_URL ?? "http://localhost:8787";

const requestJson = async <T extends object>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as T | { error?: string };
  if (!response.ok) {
    const code = "error" in body && body.error ? body.error : `http_${response.status}`;
    throw new Error(code);
  }
  return body as T;
};

const postJson = <T extends object>(path: string, body: unknown): Promise<T> =>
  requestJson<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const run = async (): Promise<void> => {
  const room = await postJson<Room>("/v1/rooms", {
    name: "Reference multiplayer",
    maxPlayers: 2,
  });
  const threeDs = await postJson<JoinedPlayer>(`/v1/rooms/${room.id}/players`, {
    displayName: "3DS reference",
    platform: "3ds",
  });
  const switchPlayer = await postJson<JoinedPlayer>(`/v1/rooms/${room.id}/players`, {
    displayName: "Switch reference",
    platform: "switch",
  });

  console.log(`Room ${room.id} started with two reference clients.`);

  for (let sequence = 1; sequence <= 5; sequence += 1) {
    await postJson(`/v1/rooms/${room.id}/state`, {
      playerId: threeDs.player.id,
      x: sequence * 2,
      y: 1,
      buttons: sequence === 1 ? ["A"] : [],
      sequence,
    });
    await postJson(`/v1/rooms/${room.id}/state`, {
      playerId: switchPlayer.player.id,
      x: 10 - sequence,
      y: 4,
      buttons: sequence === 3 ? ["B"] : [],
      sequence,
    });

    const state = await requestJson<StateResponse>(`/v1/rooms/${room.id}/state`);
    console.log(`tick ${sequence}: ${state.states.map((player) => `${player.playerId.slice(0, 8)}=(${player.x},${player.y})`).join(" ")}`);
    await wait(100);
  }

  console.log("Reference multiplayer flow completed.");
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
