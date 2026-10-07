# Production deployment (Docker + nginx-proxy)

Same pattern as the other apps on the server: it already runs `nginxproxy/nginx-proxy` and
`nginxproxy/acme-companion` on a Docker network named `proxy`, which route each domain to its
container and issue the HTTPS certificates.

| | Domain | Container |
| --- | --- | --- |
| Frontend (ceremony, `/organiser`, `/operator`) | `https://tuda.intelithon.in` | `tuda-frontend` (nginx) |
| Backend (operator alert signal) | `https://tuda-api.intelithon.in` | `tuda-backend` (Node) |

Both DNS A records must point at the server before starting, or the certificates cannot be issued.
No database is used and no ports are published on the host.

## First deployment

```bash
cd /root/apps
git clone https://github.com/jathin12e/tuda.git tuda && cd tuda
cp .env.example .env          # then set LETSENCRYPT_EMAIL
docker compose build
docker compose up -d
```

## Verify

```bash
docker compose ps
docker compose logs --tail 20 backend
curl https://tuda-api.intelithon.in/api/health     # {"ok":true}
```

Then open `https://tuda.intelithon.in/organiser`: the **Operator alert** panel should not say
"Not available", and **Offline readiness** should reach "Ready for offline use".

## Redeploying after code changes

```bash
cd /root/apps/tuda
git pull
docker compose build
docker compose up -d
```

Avoid redeploying shortly before the ceremony:

- Restarting `tuda-backend` returns operator screens to standby (the alert state is kept in memory).
- A new frontend build is only picked up by a device after the app is fully closed and reopened.

## Changing the domains

Edit `docker-compose.yml`: `VIRTUAL_HOST` / `LETSENCRYPT_HOST` for both services, `CORS_ORIGIN`
(the frontend address) on the backend, and `VITE_API_URL` (the backend address + `/api`) on the
frontend. Then rebuild.
