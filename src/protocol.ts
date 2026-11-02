export const PROTOCOL_VERSION = 1;

export type Platform = "3ds" | "switch" | "desktop";

export interface Player {
  readonly id: string;
  readonly displayName: string;
  readonly platform: Platform;
  readonly joinedAt: string;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly maxPlayers: number;
  readonly createdAt: string;
  readonly players: Player[];
}

export interface CreateRoomRequest {
  readonly name?: unknown;
  readonly maxPlayers?: unknown;
}

export interface JoinRoomRequest {
  readonly displayName?: unknown;
  readonly platform?: unknown;
}

export interface PlayerState {
  readonly playerId: string;
  readonly x: number;
  readonly y: number;
  readonly buttons: string[];
  readonly sequence: number;
  readonly sentAt: string;
}

export interface PublishStateRequest {
  readonly playerId?: unknown;
  readonly x?: unknown;
  readonly y?: unknown;
  readonly buttons?: unknown;
  readonly sequence?: unknown;
}

export interface Session {
  readonly id: string;
  readonly displayName: string;
  readonly platform: Platform;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface SessionResponse {
  readonly protocolVersion: number;
  readonly session: Session;
  readonly token: string;
}

export interface Encounter {
  readonly id: string;
  readonly gameId: string;
  readonly payload: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export const isPlatform = (value: unknown): value is Platform =>
  value === "3ds" || value === "switch" || value === "desktop";
