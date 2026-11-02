import { OpenLinkClient } from "./client.js";

interface Room {
  readonly id: string;
}

const baseUrl = process.env.OPENLINK_URL ?? "http://localhost:8787";

const createRoom = async (): Promise<Room> => {
  const response = await fetch(`${baseUrl}/v1/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Client library demo", maxPlayers: 2 }),
  });
  return response.json() as Promise<Room>;
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const run = async (): Promise<void> => {
  const room = await createRoom();
  const threeDs = new OpenLinkClient({ baseUrl, displayName: "3DS client", platform: "3ds" });
  const switchClient = new OpenLinkClient({ baseUrl, displayName: "Switch client", platform: "switch" });
  let receivedStates = 0;

  await threeDs.authenticate();
  await switchClient.authenticate();
  await threeDs.joinRoom(room.id);
  await switchClient.joinRoom(room.id);
  threeDs.onState(() => { receivedStates += 1; });
  switchClient.onState(() => { receivedStates += 1; });

  for (let sequence = 1; sequence <= 3; sequence += 1) {
    threeDs.sendState(sequence, 1, [], sequence);
    switchClient.sendState(10 - sequence, 4, [], sequence);
    await wait(50);
  }

  threeDs.close();
  switchClient.close();
  if (receivedStates !== 12) {
    throw new Error(`expected 12 relayed states, received ${receivedStates}`);
  }
  console.log(`Client library demo completed: ${receivedStates} states relayed.`);
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
