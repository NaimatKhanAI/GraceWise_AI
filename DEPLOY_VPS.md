# GraceWise AI VPS Deployment Guide (Ubuntu 22.04/24.04)

This guide deploys:
- Frontend (static HTML/CSS/JS) via Nginx
- Backend (Flask) via Gunicorn + systemd
- MySQL database on VPS
- Single domain with reverse proxy (`/api` -> Flask)

## 1) VPS and domain prerequisites

- VPS (Ubuntu) with public IP
- Domain DNS A record pointing to VPS IP
- SSH access: `ssh root@YOUR_VPS_IP`

## 2) Install base packages

```bash
apt update && apt upgrade -y
apt install -y python3 python3-venv python3-pip nginx mysql-server git certbot python3-certbot-nginx
```

## 3) Clone project on VPS

```bash
mkdir -p /var/www
cd /var/www
git clone <your-repo-url> gracewise
cd gracewise
```

## 4) Backend setup

```bash
cd /var/www/gracewise/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

## 5) MySQL setup

Login:
```bash
mysql -u root -p
```

Run SQL:
```sql
CREATE DATABASE gracewise CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'graceuser'@'localhost' IDENTIFIED BY 'STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON gracewise.* TO 'graceuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 6) Configure backend env

```bash
cd /var/www/gracewise/backend
cp .env.example .env
nano .env
```

Set at least:
- `FLASK_ENV=production`
- `FLASK_DEBUG=false`
- `HOST=127.0.0.1`
- `PORT=5000`
- `CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com`
- `JWT_SECRET_KEY=<strong-random-secret>`
- `DB_USER=graceuser`
- `DB_PASSWORD=<your-db-password>`
- `DB_HOST=127.0.0.1`
- `DB_NAME=gracewise`
- `OPENAI_API_KEY=<your-key>`
- `ADMIN_PASSWORD=<strong-admin-password>`

## 7) Create systemd service

Create `/etc/systemd/system/gracewise.service`:

```ini
[Unit]
Description=GraceWise Flask API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/gracewise/backend
EnvironmentFile=/var/www/gracewise/backend/.env
ExecStart=/var/www/gracewise/backend/.venv/bin/gunicorn -w 2 -k gthread --threads 4 -b 127.0.0.1:5000 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable gracewise
systemctl start gracewise
systemctl status gracewise
```

## 8) Nginx config (frontend + API proxy)

Create `/etc/nginx/sites-available/gracewise`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/gracewise/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
ln -s /etc/nginx/sites-available/gracewise /etc/nginx/sites-enabled/gracewise
nginx -t
systemctl restart nginx
```

## 9) SSL (HTTPS)

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Auto-renew check:

```bash
systemctl status certbot.timer
```

## 10) Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## 11) Verify deployment

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/api/auth/login
systemctl status gracewise
journalctl -u gracewise -n 100 --no-pager
```

## 12) Update deployment after new code push

```bash
cd /var/www/gracewise
git pull
cd backend
source .venv/bin/activate
pip install -r requirements.txt
systemctl restart gracewise
systemctl status gracewise
```

## Important security notes

- Rotate any API key that was ever committed in git history.
- Use strong values for `JWT_SECRET_KEY`, `DB_PASSWORD`, `ADMIN_PASSWORD`.
- Keep `FLASK_DEBUG=false` in production.
- Keep backend bound to `127.0.0.1` and expose only via Nginx.
