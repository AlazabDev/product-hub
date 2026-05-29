# Deployment Guide

Complete guide for deploying AzProud to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
3. [Docker Deployment](#docker-deployment)
4. [Manual Server Deployment](#manual-server-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Rollback Procedure](#rollback-procedure)
10. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

### Code Quality
- [ ] All tests passing: `bun run test`
- [ ] No TypeScript errors: `bun run build`
- [ ] No console errors or warnings in dev: `bun run dev`
- [ ] Code reviewed by at least one team member
- [ ] Branch is up-to-date with main: `git pull origin main`

### Security
- [ ] No API keys in code: `grep -r "SUPABASE_KEY\|AZURE_KEY" src/`
- [ ] Environment variables documented in `.env.example`
- [ ] Rate limiting configured
- [ ] CORS policies set for production domain
- [ ] Database RLS policies reviewed and enabled
- [ ] Email verification enabled in Supabase Auth

### Performance
- [ ] Bundle size < 250KB gzipped
- [ ] Lighthouse score > 80
- [ ] Database indexes created for filter columns
- [ ] Caching strategy configured
- [ ] CDN enabled for static assets

### Data & Documentation
- [ ] Database backup tested
- [ ] Deployment documentation updated
- [ ] API documentation current
- [ ] User guide prepared
- [ ] CHANGELOG.md updated with new version

### Team
- [ ] Deployment approved by product owner
- [ ] Runbook reviewed by ops team
- [ ] Support team trained on new features
- [ ] Incident response plan prepared

---

## Vercel Deployment (Recommended)

### 1. GitHub Integration

```bash
# Ensure you're on the correct branch
git checkout main
git pull origin main

# Push to GitHub
git push origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Select "Import Git Repository"
4. Select the `uberfiix/az-product` repository
5. Configure project:
   - **Project Name:** az-product (or custom)
   - **Framework Preset:** Vite
   - **Root Directory:** ./
   - **Build Command:** `bun run build`
   - **Output Directory:** `dist`

### 3. Environment Variables

Configure in Vercel Dashboard → Settings → Environment Variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
AZURE_OPENAI_API_KEY=your-azure-key-here
VITE_API_URL=https://azproud.vercel.app/api
NODE_ENV=production
```

### 4. Deploy

- **Automatic:** Deployment happens on every push to main
- **Manual:** Click "Deploy" in Vercel Dashboard

### 5. Monitor Deployment

```bash
# Watch deployment status
# Option 1: Vercel CLI
vercel logs --follow

# Option 2: Web dashboard
# https://vercel.com/projects/az-product/deployments
```

### 6. Configure Custom Domain

1. Vercel Dashboard → Settings → Domains
2. Add your domain (e.g., azproud.alazab.com)
3. Update DNS records as instructed
4. Enable automatic SSL/TLS

---

## Docker Deployment

### 1. Build Docker Image

```dockerfile
# Dockerfile provided in repository
docker build -t azproud:latest -t azproud:1.0.0 .
```

### 2. Push to Registry

```bash
# Docker Hub
docker tag azproud:latest username/azproud:latest
docker push username/azproud:latest

# Or: AWS ECR, GCP Artifact Registry, Azure Container Registry
```

### 3. Run Container

```bash
docker run -d \
  --name azproud \
  -p 3000:3000 \
  -e VITE_SUPABASE_URL="https://your-project.supabase.co" \
  -e VITE_SUPABASE_ANON_KEY="your-key" \
  -e AZURE_OPENAI_API_KEY="your-key" \
  --restart unless-stopped \
  azproud:latest
```

### 4. Docker Compose (Multi-Container)

```yaml
version: '3.8'
services:
  web:
    image: azproud:latest
    ports:
      - "3000:3000"
    environment:
      VITE_SUPABASE_URL: https://your-project.supabase.co
      VITE_SUPABASE_ANON_KEY: your-key
    restart: unless-stopped
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - web
```

### 5. Kubernetes (Production Scale)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: azproud
spec:
  replicas: 3
  selector:
    matchLabels:
      app: azproud
  template:
    metadata:
      labels:
        app: azproud
    spec:
      containers:
      - name: azproud
        image: azproud:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: VITE_SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: azproud-secrets
              key: supabase-url
        - name: VITE_SUPABASE_ANON_KEY
          valueFrom:
            secretKeyRef:
              name: azproud-secrets
              key: supabase-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## Manual Server Deployment

### 1. Server Setup

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js/Bun
curl https://bun.sh/install | bash

# Install Nginx (reverse proxy)
sudo apt-get install -y nginx
```

### 2. Clone Repository

```bash
cd /var/www
sudo git clone https://github.com/uberfiix/az-product.git
cd az-product
sudo chown -R $USER:$USER .
```

### 3. Install Dependencies & Build

```bash
bun install
bun run build
```

### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/azproud
upstream azproud {
    server localhost:3000;
}

server {
    listen 80;
    server_name azproud.alazab.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name azproud.alazab.com;
    
    ssl_certificate /etc/letsencrypt/live/azproud.alazab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/azproud.alazab.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://azproud;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;
}
```

### 5. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/azproud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Install SSL Certificate

```bash
sudo certbot certonly --nginx -d azproud.alazab.com
```

### 7. Setup Service (Systemd)

```ini
# /etc/systemd/system/azproud.service
[Unit]
Description=AzProud Production Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/az-product
Environment="PATH=/home/user/.bun/bin"
ExecStart=bun run preview
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8. Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable azproud
sudo systemctl start azproud
sudo systemctl status azproud
```

---

## Environment Configuration

### Development (.env.local)

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
AZURE_OPENAI_API_KEY=your-local-key
NODE_ENV=development
```

### Staging (.env.staging)

```env
VITE_SUPABASE_URL=https://staging.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
AZURE_OPENAI_API_KEY=your-staging-key
NODE_ENV=production
VITE_API_URL=https://staging-azproud.vercel.app/api
```

### Production (.env.production)

```env
VITE_SUPABASE_URL=https://prod.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
AZURE_OPENAI_API_KEY=your-prod-key
NODE_ENV=production
VITE_API_URL=https://azproud.alazab.com/api
```

---

## Database Setup

### 1. Supabase Setup

```bash
# Create Supabase project
# 1. Go to https://supabase.com/dashboard
# 2. Click "New Project"
# 3. Name: "AzProud Production"
# 4. Region: Closest to your users
# 5. Generate strong password
```

### 2. Initialize Database

```bash
# Run migrations
supabase db push --db-url "postgresql://..."

# Or: Seed test data
supabase db seed
```

### 3. Enable RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### 4. Setup Backups

```bash
# Supabase Dashboard → Settings → Backups
# - Enable daily backups
# - Retention: 30 days
# - Backup time: 2 AM UTC
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check app is running
curl https://azproud.alazab.com/health
# Expected: 200 OK

# Check database connection
curl https://azproud.alazab.com/api/health
# Expected: {"status": "ok", "database": "connected"}

# Check Supabase
curl https://azproud.alazab.com/api/supabase-health
# Expected: 200 OK
```

### 2. Functionality Tests

- [ ] Login page loads
- [ ] Create new account
- [ ] Create product
- [ ] Upload asset
- [ ] List products
- [ ] Search products
- [ ] Create supplier
- [ ] Create request
- [ ] Check audit logs
- [ ] Test dark/light theme

### 3. Performance Tests

```bash
# Lighthouse audit
npm run lighthouse

# Load testing (50 concurrent users)
k6 run tests/load-test.js --vus 50 --duration 30s

# Results should show: response time < 200ms
```

### 4. Security Tests

```bash
# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://azproud.alazab.com

# SSL Labs test
# https://www.ssllabs.com/ssltest/analyze.html?d=azproud.alazab.com
```

---

## Monitoring & Maintenance

### 1. Setup Monitoring

```bash
# Vercel Analytics
vercel analytics

# Supabase Monitoring
# Dashboard → Monitoring
# - Database load
# - Auth metrics
# - Storage usage

# Uptime Monitoring
# https://uptimerobot.com
# Configure alerts for downtime
```

### 2. Logging

```bash
# Vercel logs
vercel logs

# Supabase logs
SELECT * FROM event_triggers_logs;

# Application logs
tail -f /var/log/azproud/app.log
```

### 3. Maintenance Tasks

**Daily:**
- Monitor error rates
- Check database performance
- Verify backups

**Weekly:**
- Review analytics
- Check security alerts
- Update dependencies

**Monthly:**
- Database optimization
- Storage cleanup
- Security audit

---

## Rollback Procedure

### If deployment fails:

```bash
# Option 1: Vercel (instant)
vercel rollback

# Option 2: Git
git revert <commit-hash>
git push origin main

# Option 3: Docker
docker run -d --name azproud azproud:1.0.0-previous

# Option 4: Manual
# Restore from database backup
# Restore previous build files
```

---

## Troubleshooting

### App won't start

```bash
# Check logs
vercel logs
# or
docker logs azproud

# Check environment variables
echo $VITE_SUPABASE_URL

# Verify dependencies
bun install

# Rebuild
bun run build
```

### Database connection error

```bash
# Verify connection string
echo $VITE_SUPABASE_URL

# Test connection
psql -h your-host -U postgres -d postgres

# Check Supabase status: https://status.supabase.com
```

### Performance degradation

```bash
# Check database query times
EXPLAIN ANALYZE SELECT * FROM products WHERE status = 'approved';

# Add missing indexes
CREATE INDEX idx_products_status ON products(status);

# Check bundle size
du -sh dist/
```

### SSL certificate error

```bash
# Renew certificate
sudo certbot renew

# Check expiry
openssl x509 -in /etc/letsencrypt/live/domain/cert.pem -noout -dates
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
