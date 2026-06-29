# DropTrack production deployment

Single-EC2 + S3 setup, on-box Postgres + PostGIS.

```
droptrack.com.au          → S3 + CloudFront                (apps/marketing static export)
portal.droptrack.com.au   → EC2 nginx → Next.js + NestJS   (apps/web + apps/api)
                            └─ Postgres 17 + PostGIS 3.6 on 127.0.0.1
```

## 1. EC2 instance

| | |
|---|---|
| Region | `ap-southeast-2` (Sydney) |
| AMI | Ubuntu Server 22.04 LTS |
| Type | **t3.medium** to start (2 vCPU, 4 GB RAM). Bump to `m6i.large` if AI calls or Overpass pegs CPU. |
| Storage | 30 GB gp3 — enough for Postgres + logs + 6-week growth |
| Inbound SG | 22 (ssh, your IP only), 80, 443 |
| Outbound SG | all (needed for Bedrock, Cognito, Mapbox, Overpass, S3, SES) |
| Elastic IP | yes — so the A record on `portal.droptrack.com.au` doesn't churn |

## 2. Box bootstrap (one time, as `ubuntu`)

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx certbot python3-certbot-nginx git build-essential

# Node 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
sudo npm i -g pnpm@9.12.0 pm2

# Postgres 17 + PostGIS 3.6
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt -y install postgresql-17 postgresql-17-postgis-3

# Lock Postgres to localhost only — it never leaves the box
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = '127.0.0.1'/" /etc/postgresql/17/main/postgresql.conf
sudo systemctl restart postgresql
```

## 3. Postgres user + database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER droptrack WITH PASSWORD '<strong-password>';
CREATE DATABASE droptrack OWNER droptrack;
\c droptrack
CREATE EXTENSION postgis;
CREATE EXTENSION citext;
GRANT ALL PRIVILEGES ON SCHEMA public TO droptrack;
SQL
```

Verify: `psql -h 127.0.0.1 -U droptrack -d droptrack -c "SELECT postgis_version();"`

## 4. Deploy code

```bash
sudo -u ubuntu git clone https://github.com/<your-org>/droptrack.git /var/www/droptrack
cd /var/www/droptrack
pnpm install --frozen-lockfile
pnpm --filter @droptrack/db build
pnpm --filter @droptrack/api build
pnpm --filter @droptrack/web build

# Apply migrations
cd packages/db && pnpm exec drizzle-kit migrate
```

## 5. Environment

`/var/www/droptrack/.env` (mode 600, owned by ubuntu):

```bash
NODE_ENV=production
PORT=3001

DATABASE_URL=postgres://droptrack:<strong-password>@127.0.0.1:5432/droptrack
WEB_BASE_URL=https://portal.droptrack.com.au

# Cognito (DropVerify sandbox / live pool)
AWS_REGION=ap-southeast-2
COGNITO_REGION=ap-southeast-2
COGNITO_USER_POOL_ID=ap-southeast-2_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Bedrock for AI Job Creator + report writer
AWS_BEDROCK_REGION=ap-southeast-2
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0

# SES for invite + receipt emails
AWS_SES_REGION=ap-southeast-2
SES_FROM_EMAIL=hello@droptrack.com.au

# S3 for logo / report uploads
S3_BUCKET=droptrack-uploads

# Overpass (Smart Zones street-count fallback)
OVERPASS_URL=https://overpass-api.de/api/interpreter

# Dropper deep-link (for invite emails)
DROPPER_DEEP_LINK_BASE=droptrackdropper://accept
```

`/var/www/droptrack/apps/web/.env.production`:

```bash
NEXT_PUBLIC_API_ORIGIN=https://portal.droptrack.com.au
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijoi…           # public token, fine in client bundle
NEXT_PUBLIC_MARKETING_URL=https://droptrack.com.au
```

## 6. systemd services

`/etc/systemd/system/droptrack-api.service`:

```ini
[Unit]
Description=DropTrack NestJS API
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/droptrack
EnvironmentFile=/var/www/droptrack/.env
ExecStart=/usr/bin/node --env-file=.env apps/api/dist/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/droptrack-web.service`:

```ini
[Unit]
Description=DropTrack Next.js webapp
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/droptrack/apps/web
Environment=PORT=3002
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now droptrack-api droptrack-web
sudo systemctl status droptrack-api droptrack-web
```

## 7. nginx (TLS + path routing)

`/etc/nginx/sites-available/portal.droptrack.com.au`:

```nginx
server {
    listen 80;
    server_name portal.droptrack.com.au;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.droptrack.com.au;

    # Filled in by certbot
    ssl_certificate     /etc/letsencrypt/live/portal.droptrack.com.au/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.droptrack.com.au/privkey.pem;

    # Real client IP for rate-limiting / logs
    set_real_ip_from 0.0.0.0/0;
    real_ip_header  X-Forwarded-For;
    real_ip_recursive on;

    client_max_body_size 4M;          # S3 upload presign body, not the upload itself

    # API routes
    location /api/      { proxy_pass http://127.0.0.1:3001; include /etc/nginx/proxy_params; }
    location /health    { proxy_pass http://127.0.0.1:3001; include /etc/nginx/proxy_params; }
    location /webhooks/ { proxy_pass http://127.0.0.1:3001; include /etc/nginx/proxy_params; }

    # WebSocket gateway
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }

    # Everything else → Next.js
    location / {
        proxy_pass http://127.0.0.1:3002;
        include /etc/nginx/proxy_params;
    }
}
```

Then:

```bash
sudo ln -s /etc/nginx/sites-available/portal.droptrack.com.au /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d portal.droptrack.com.au   # gets cert + auto-renew
```

## 8. Marketing site → S3

```bash
cd /var/www/droptrack/apps/marketing
NEXT_PUBLIC_APP_URL=https://portal.droptrack.com.au pnpm build
aws s3 sync out/ s3://droptrack-com-au --region ap-southeast-2 --delete
aws cloudfront create-invalidation --distribution-id <CF-id> --paths '/*'
```

The marketing build embeds `https://portal.droptrack.com.au/login` and `/signup` into all CTAs (just configured in `apps/marketing/lib/site.ts`).

## 9. DNS (GoDaddy or Route 53)

```
droptrack.com.au          A      → CloudFront distribution (or ALIAS if R53)
portal.droptrack.com.au   A      → EC2 Elastic IP
api.droptrack.com.au      → not used (path-based routing on portal subdomain)
```

## 10. Smoke test after deploy

```bash
curl -sI https://droptrack.com.au/                              # 200 from CloudFront
curl -sI https://portal.droptrack.com.au/                       # 200 from Next.js
curl -s  https://portal.droptrack.com.au/health                 # {"status":"ok"}
curl -sI https://portal.droptrack.com.au/api/me/profile         # 401 (auth required = good)
```

## 11. Backup & ops

| | |
|---|---|
| Postgres dumps | nightly `pg_dump | gzip | aws s3 cp -` to `s3://droptrack-backups/postgres/` |
| EBS snapshots | daily Data Lifecycle Manager policy |
| Logs | `journalctl -u droptrack-api -u droptrack-web` |
| Updates | `git pull && pnpm install && pnpm --filter ... build && sudo systemctl restart droptrack-{api,web}` |
| Postgres on same box | a real load problem if you hit > 5 concurrent campaigns. Plan to move DB to RDS once revenue justifies it. |

## 12. Pre-flight blockers (from the readiness audit)

These still need code changes before `systemctl start`:

- [ ] Lock CORS to `https://portal.droptrack.com.au` (was `*`)
- [ ] Lock realtime gateway CORS to the same origin (was `*`)
- [ ] Strip "Use demo account" button from `/login` when `NODE_ENV=production`
- [ ] Remove or guard dead Stripe controller paths
- [ ] Wipe seed users (`james@droptrack.au`, `maya@droptrack.au`, `test.invite+*`) before issuing real invites
- [ ] Add `@nestjs/throttler` + `helmet` (suggested but not blocking first launch)
