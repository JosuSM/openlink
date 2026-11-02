# 3DS and StreetPass compatibility

## Scope

OpenLink can provide a native homebrew client for Nintendo 3DS software and an application-level encounter service inspired by StreetPass. It will not replace, patch, or inject into the official Nintendo StreetPass system.

StreetPass is a local exchange mechanism with system- and title-specific behavior. OpenLink's online room service is a different transport. A supported game must explicitly integrate the OpenLink adapter or use a tested homebrew plugin.

## Two supported modes

### OpenLink Online

The client joins a room and exchanges live player state through the OpenLink server. This is the mode used for multiplayer matches.

### OpenLink Encounters

A client uploads a small game-owned encounter payload. Another client can receive a compatible payload later. The payload is opaque to OpenLink and is identified by a versioned game ID.

The current service endpoints are:

- `POST /v1/encounters`: publish an authenticated base64 payload for a `gameId`;
- `POST /v1/encounters/consume`: consume and remove pending payloads for a `gameId`.

Payloads are limited to 512 decoded bytes and expire automatically. Consumption is one-time, so a client should validate the payload before applying it to game state.

Required encounter properties:

- game ID and protocol version;
- bounded payload size;
- expiry time;
- replay protection;
- no firmware or title data;
- validation performed by the game adapter.

The 3DS header at `native/3ds/openlink_protocol.h` defines the first compact data types for a native client. It is intentionally independent from the TypeScript server implementation so a devkitARM/libctru client can use the same field sizes.

## Native client boundary

A 3DS adapter should provide these operations:

1. initialize networking;
2. authenticate an OpenLink session;
3. join and leave a room;
4. send and receive player state;
5. publish and consume an encounter payload;
6. close networking cleanly.

The adapter must not include Nintendo firmware, keys, game data, or code that modifies another title. Any game-specific StreetPass behavior belongs to a separately reviewed game adapter.

## First 3DS milestone

Build a small homebrew test application that displays connection status, sends a player state, and exchanges one encounter payload. Do this before attempting compatibility with a commercial title or with the official StreetPass system.
