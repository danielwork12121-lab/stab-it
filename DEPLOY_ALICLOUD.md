# StabIt — Alibaba Cloud Deployment Guide

## Requirements

- Node.js 18+ (for built-in `fetch` and `AbortController`)
- PM2 (process manager): `npm install -g pm2`
- Nginx (reverse proxy, HTTPS termination)
- A domain pointing to the Alibaba Cloud server's public IP

## Architecture

```
Public HTTPS (443)
  │
  ▼
Nginx
  ├── /assets/**, /js/**, /              → reverse proxy to http://127.0.0.1:3001
  └── /api/health, /api/ai/*            → reverse proxy to http://127.0.0.1:3001
                                              │
                                              ▼
                                     Node.js (Express)
                                     listens 127.0.0.1:3001
```

The Node.js process **never binds to a public interface**. Only Nginx is publicly exposed on ports 80/443.

## First-time Setup

```bash
# 1. Install Node 18+ and PM2
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
npm install -g pm2

# 2. Clone the repo
git clone <repo-url> /opt/stabit
cd /opt/stabit

# 3. Install dependencies
npm install

# 4. Create environment file
cp .env.example .env
# Edit .env and fill in your actual API keys and model IDs
# NEVER commit .env — it is already gitignored

# 5. Set ownership
sudo chown -R <app-user>:<app-user-group> /opt/stabit
```

## Environment Variables

All variables are listed in `.env.example`. The server reads them from the shell environment or from a `.env` file. Key variables:

| Variable | Purpose |
|---|---|
| `HOST` | Must be `127.0.0.1` (no public binding) |
| `PORT` | Default `3001` |
| `NODE_ENV` | `production` |
| `AI_PROVIDER` | `doubao` |
| `DOUBAO_API_KEY` | Doubao Ark API key |
| `DOUBAO_MODEL_ID` | Doubao model ID |
| `AI_FUNCTION_MAX_DURATION_MS` | Set to `300000` or higher (persistent server has no 60s cap) |

## Local Smoke Test (Before PM2)

```bash
# Start the server
npm start

# Test health endpoint
curl -s http://127.0.0.1:3001/api/health
# Expected: {"ok":true,"service":"stabit","timestamp":"..."}

# Test static serving
curl -I http://127.0.0.1:3001/
# Expected: 200 OK

# Test 404 for unknown API route
curl -i http://127.0.0.1:3001/api/not-real
# Expected: {"error":"Not found"}

# Test 405 for GET on chat endpoint
curl -i http://127.0.0.1:3001/api/ai/chat
# Expected: {"error":"Method not allowed"} (405)

# Stop the server
Ctrl+C
```

## PM2 Management

```bash
# Start
cd /opt/stabit
pm2 start ecosystem.config.cjs
pm2 save

# Status
pm2 status

# Logs
pm2 logs stabit

# Reload (zero-downtime restart)
pm2 reload stabit

# Restart
pm2 restart stabit

# Stop
pm2 stop stabit

# Delete
pm2 delete stabit
```

## Nginx Configuration

Create `/etc/nginx/conf.d/stabit.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/your-domain.com.pem;
    ssl_certificate_key /etc/nginx/ssl/your-domain.com.key;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 1m;
    }
}
```

Test and reload:

```bash
sudo nginx -t
sudo nginx -s reload
```

## Deployment by Exact Git Commit

```bash
# On the server
cd /opt/stabit
git fetch origin
git checkout <commit-sha>
npm install
pm2 reload stabit

# Verify
curl -s http://127.0.0.1:3001/api/health
curl -I https://your-domain.com/
```

## Rollback Procedure

```bash
cd /opt/stabit
git checkout <previous-commit-sha>
npm install
pm2 reload stabit
```

## Dual-Deployment with Vercel

Vercel continues to serve the same repository via serverless functions. Both deployments share:
- Identical `api/ai/chat.js` handler
- Identical `public/` frontend
- Identical AI prompts and response schemas

The only difference is the HTTP glue:
- **Vercel**: auto-discovers `api/*.js` and routes them as serverless functions
- **Alibaba**: `server.mjs` imports the same handlers and routes them via Express

If Alibaba is unavailable, switch the DNS back to Vercel. No code changes required.

## Security Checklist

- [ ] `HOST=127.0.0.1` in `.env` — server never binds publicly
- [ ] Nginx is the only public-facing service (ports 80/443)
- [ ] Internal port 3001 is **not** exposed in security group / firewall
- [ ] `.env` is never committed (already gitignored)
- [ ] API keys are rotated and stored only in `.env`
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] `AI_DEBUG=false` in production
- [ ] Never manually edit production source files — always deploy via git

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `ECONNREFUSED` on port 3001 | PM2 not running | `pm2 start ecosystem.config.cjs` |
| 502 Bad Gateway from Nginx | Node not reachable | Check `pm2 logs stabit` |
| 401/403 from AI provider | Wrong API key | Verify `DOUBAO_API_KEY` in `.env` |
| AI timeout after 60s | Budget too low | Set `AI_FUNCTION_MAX_DURATION_MS=300000` |
| `npm install` fails | Node version too old | Upgrade to Node 18+ |