# OpenLink

OpenLink is a homebrew-oriented alternative multiplayer platform for Nintendo 3DS and Nintendo Switch, with a long-term goal of running supported 3DS homebrew software through a Switch emulator and connecting it to real 3DS clients.

## Project status

Early architecture stage. The first milestone is not commercial game compatibility. It is a legal, testable multiplayer proof of concept using a small homebrew client and an independent OpenLink protocol.

## Initial milestone

- A simple 3DS-compatible client can join an OpenLink room.
- A desktop reference client can join the same room.
- Both clients can exchange player state through the OpenLink server.
- The protocol is documented and versioned.
- No Nintendo firmware, keys, games, or proprietary server assets are distributed.

## Planned components

- `protocol`: versioned messages and compatibility rules.
- `server`: rooms, identity, matchmaking, and relay services.
- `client-3ds`: small homebrew reference client.
- `client-switch`: later homebrew client and emulator integration boundary.
- `docs`: architecture and implementation decisions.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the initial design.
