# OpenLink 3DS client

This folder contains the native homebrew client scaffold for devkitARM and libctru.

## Toolchain

Install devkitPro with the 3DS development tools, then ensure `DEVKITPRO` and `DEVKITARM` are available in the shell. The current build uses the installed compiler paths explicitly, so it can also be run from the devkitPro MSYS shell with those variables exported.

## Build

From this directory:

```text
make
```

The build produces `openlink_3ds.3dsx`. The first application validates the native build boundary, screen output, input handling, and shared protocol constants. It does not connect to OpenLink yet.

The application now performs a one-time `GET /health` request at startup. The default build targets the Render service at `https://openlink-server.onrender.com/health`. Override it for another deployment or a LAN server:

```text
make SERVER_URL=https://your-service.onrender.com/health
```

The HTTPS certificate is validated through the default libctru root certificates. If a deployment uses a certificate chain unavailable on the 3DS, it must provide a compatible trusted root before production use.

## Next native slice

Replace the local state display with a transport adapter that implements session creation, session renewal, encounter publish/consume, and live room state. Keep the adapter independent from the UI so the same protocol can later be used by a supported homebrew game.
