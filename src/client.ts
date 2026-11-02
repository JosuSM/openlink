import { WebSocket } from "ws";
import type { PlayerState, SessionResponse } from "./protocol.js";

export interface OpenLinkClientOptions {
  readonly baseUrl: string;
  readonly displayName: string;
  readonly platform: "3ds" | "switch";
}

export interface StateEvent {
  readonly state: PlayerState;
}

interface JoinedMessage {
  readonly type: "joined";
  readonly player: { readonly id: string };
}

interface StateMessage extends StateEvent {
  readonly type: "state";
}

export class OpenLinkClient {
  private readonly baseUrl: string;
  private readonly displayName: string;
  private readonly platform: "3ds" | "switch";
  private session?: SessionResponse;
  private socket: WebSocket | undefined;
  private playerId: string | undefined;
  private stateListener?: (event: StateEvent) => void;

  public constructor(options: OpenLinkClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.displayName = options.displayName;
    this.platform = options.platform;
  }

  public async authenticate(): Promise<void> {
    this.session = await this.request<SessionResponse>("/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ displayName: this.displayName, platform: this.platform }),
    });
  }

  public async refresh(): Promise<void> {
    if (!this.session) {
      throw new Error("authenticate_required");
    }
    this.session = await this.request<SessionResponse>("/v1/sessions/refresh", {
      method: "POST",
      body: JSON.stringify({ token: this.session.token }),
    });
  }

  public async joinRoom(roomId: string): Promise<void> {
    if (!this.session) {
      throw new Error("authenticate_required");
    }

    const socketUrl = this.baseUrl.replace(/^http/, "ws");
    const socket = new WebSocket(`${socketUrl}/v1/rooms/${roomId}/live`);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as JoinedMessage | StateMessage;
        if (message.type === "joined") {
          this.playerId = message.player.id;
          resolve();
          return;
        }
        if (message.type === "state") {
          this.stateListener?.(message);
        }
      });
      socket.once("open", () => {
        socket.send(JSON.stringify({ type: "join", token: this.session?.token }));
      });
    });
  }

  public onState(listener: (event: StateEvent) => void): void {
    this.stateListener = listener;
  }

  public sendState(x: number, y: number, buttons: string[], sequence: number): void {
    if (!this.socket || !this.playerId) {
      throw new Error("join_required");
    }
    this.socket.send(JSON.stringify({ type: "state", x, y, buttons, sequence }));
  }

  public close(): void {
    this.socket?.close();
    this.socket = undefined;
    this.playerId = undefined;
  }

  private async request<T extends object>(path: string, init: { method: string; body: string }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json" },
    });
    const body = await response.json() as T | { readonly error?: string };
    if (!response.ok) {
      const code = "error" in body && body.error ? body.error : `http_${response.status}`;
      throw new Error(code);
    }
    return body as T;
  }
}
