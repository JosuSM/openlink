# OpenLink architecture

## Goal

Provide an independent multiplayer service that can be used by supported homebrew software on 3DS and Switch. A future Switch 3DS emulator may consume the same client boundary, but emulation is deliberately outside the first milestone.

## System boundary

```text
3DS homebrew client  ---- WebSocket ---------\
                                             OpenLink server
Desktop reference client ---- WebSocket -----/       |
                                                     +-- identity
                                                     +-- rooms
                                                     +-- matchmaking
                                                     +-- relay

Future Switch emulator
        |
        +-- OpenLink client adapter
```

The server owns OpenLink identities and rooms. It must not pretend to be Nintendo infrastructure or distribute Nintendo software, firmware, keys, or game data.

HTTP is used for health checks, room discovery, and the compatibility fallback. A live room uses the WebSocket endpoint `/v1/rooms/:id/live`; clients send `join` and `state` messages, while the server broadcasts `joined`, `player_joined`, `player_left`, `state`, and `error` messages.

Clients create a temporary session with `POST /v1/sessions`, providing a display name and platform (`3ds` or `switch`). The response contains a token that must be sent in the WebSocket `join` message. Sessions are currently in-memory and expire when the server restarts; persistent accounts and token rotation belong to a later milestone.

The reference client in `src/client.ts` encapsulates this lifecycle: authenticate, refresh, join a room, send state, receive state, and close. A native 3DS or Switch client should preserve these operations while replacing the WebSocket implementation with the platform's networking layer.

## Why the emulator is not milestone one

The emulator has independent risks: CPU and GPU compatibility, two-screen presentation, input mapping, timing, system services, performance, and game-specific behavior. A protocol and room service can be tested without those risks and gives the emulator a stable integration boundary later.

## Protocol principles

- Use an explicit protocol version in every connection.
- Keep transport separate from game messages.
- Use fixed-width, documented message types.
- Include sequence numbers and timestamps for state updates.
- Treat reconnect and version mismatch as normal states.
- Never trust client-provided identity or room permissions.
- Keep game rules in the client or an explicitly versioned game server module.

## First proof of concept

The first playable test should use a tiny two-player arena with only:

- connect and authenticate with a temporary OpenLink identity;
- create, list, join, and leave a room;
- exchange position and button state;
- handle disconnect and reconnect;
- reject unsupported protocol versions.

A desktop client is useful as a reference implementation because it makes protocol debugging inexpensive before targeting console hardware.

## Technology decision for the prototype

Use a small server with a portable implementation and a desktop reference client first. Choose the exact language after checking the available 3DS and Switch homebrew toolchains. Avoid coupling the wire protocol to an emulator API or to a particular commercial game.

## Later emulator integration

The future Switch application can expose an adapter with these responsibilities:

1. Translate the emulated game's network calls into OpenLink messages.
2. Convert controller and touchscreen input into the emulated 3DS input model.
3. Present the two 3DS screens in a stable Switch layout.
4. Keep emulator timing separate from network timing.
5. Report compatibility and performance limitations explicitly.

An emulator alone does not provide crossplay. Each supported game still needs compatible game logic and a tested network adapter.
