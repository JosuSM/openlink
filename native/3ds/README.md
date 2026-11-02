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

## CIA preparation

With CIATools downloaded to its default temporary path, prepare its input files with:

```powershell
.\scripts\prepare-cia.ps1 -NoLaunch
```

The script builds the ELF and 3DSX using the Render URL, then stages them under `native/3ds/cia/input`. Run it without `-NoLaunch` to open CIATools in that folder. CIATools still requires interactive creation or selection of the Title ID, RSF, ICN, and banner resources.

Use `assets/OpenLink-48.png` as the application icon in CIATools. The editable source is `assets/OpenLink.svg`, and `assets/OpenLink-256.png` is available for larger metadata or banner work.

## Next native slice

Replace the local state display with a transport adapter that implements session creation, session renewal, encounter publish/consume, and live room state. Keep the adapter independent from the UI so the same protocol can later be used by a supported homebrew game.
