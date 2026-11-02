# Deploy OpenLink on Render

## Create the service

1. Push this repository to GitHub or another Git provider supported by Render.
2. In Render, choose **New > Blueprint** and select the repository.
3. Confirm the service from `render.yaml`.
4. Wait for the build and open the generated `https://<service>.onrender.com/health` URL.

The Blueprint runs:

```text
npm ci && npm run build
npm start
```

The service binds to Render's `PORT` environment variable and exposes the live room transport at:

```text
wss://<service>.onrender.com/v1/rooms/<room-id>/live
```

## Important limitations

The current sessions, rooms, states, and encounters are stored in memory. A restart or free-tier sleep loses them. This deployment is suitable for a prototype, not a persistent public service.

Render's free service may sleep when idle. The first request after sleep can take longer, so clients must retry health checks and reconnect WebSocket sessions.

The 3DS native client currently uses an HTTP health URL intended for LAN testing. Public Render deployment requires an HTTPS request and certificate handling on the 3DS before using it from the console.
