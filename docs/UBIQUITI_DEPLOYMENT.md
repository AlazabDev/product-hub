# Ubiquiti 24 Production Deployment Guide

Complete guide for deploying AzProud to Ubiquiti 24 server with domain: `proud.azab.services`

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Automated Deployment](#automated-deployment)
4. [Manual Steps (if needed)](#manual-steps-if-needed)
5. [Verification](#verification)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04 LTS or newer
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB minimum (50GB recommended)
- **CPU**: 2 cores minimum (4 cores recommended)

### Required Software

```bash
# These will be installed automatically by the script, but verify:
- Git
- Node.js 18+ (preferably 20.x LTS)
- npm or Bun
- Nginx
- PM2 (process manager)
- Certbot (SSL/TLS)
```

### Domain & DNS Setup

Before deployment, ensure DNS is configured:

```bash
# A Record
proud.azab.services  A  <ubiquiti-server-ip>

# CNAME Record (optional)
www.proud.azab.services  CNAME  proud.azab.services

# TXT Record for email verification (if using email services)
# _dmarc.azab.services  TXT  "v=DMARC1; p=quarantine"
```

---

## Server Setup

### Step 1: Connect to Server

```bash
ssh ubuntu@<ubiquiti-server-ip>
```

Or using domain (after DNS is configured):

```bash
ssh ubuntu@proud.azab.services
```

### Step 2: Update System

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get dist-upgrade -y
```

### Step 3: Install Required Packages

```bash
# Install Git, Nginx, Node.js, and other utilities
sudo apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    nginx \
    certbot \
    python3-certbot-nginx \
    htop \
    tmux \
    vim \
    nano

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version   # Should be v20.x.x
npm --version    # Should be 10.x.x
nginx -v         # Should show nginx version
```

### Step 4: Create Application User

```bash
# Create ubuntu user if not already created
sudo useradd -m -s /bin/bash ubuntu 2>/dev/null || true

# Create app directory
sudo mkdir -p /home/ubuntu/azproud
sudo chown -R ubuntu:ubuntu /home/ubuntu/azproud

# Create logs directory
sudo mkdir -p /home/ubuntu/azproud/logs
sudo chown -R ubuntu:ubuntu /home/ubuntu/azproud/logs
```

---

## Automated Deployment

### Step 1: Prepare Deployment Script

```bash
# Clone or update the repository
cd /home/ubuntu
git clone https://github.com/uberfiix/az-product.git az-product-temp
cd az-product-temp

# Copy the deployment script
sudo cp scripts/deploy-ubiquiti.sh /tmp/deploy-ubiquiti.sh
sudo chmod +x /tmp/deploy-ubiquiti.sh
```

### Step 2: Prepare Environment File

```bash
# Copy environment template
sudo cp .env.production.example /home/ubuntu/azproud/.env.production
sudo chown ubuntu:ubuntu /home/ubuntu/azproud/.env.production
sudo chmod 600 /home/ubuntu/azproud/.env.production

# Edit with actual values
sudo nano /home/ubuntu/azproud/.env.production

# Required environment variables to fill:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - AZURE_OPENAI_API_KEY
# - AZURE_OPENAI_ENDPOINT
```

### Step 3: Run Deployment Script

```bash
# Make script executable
sudo chmod +x /tmp/deploy-ubiquiti.sh

# Run the deployment
sudo /tmp/deploy-ubiquiti.sh

# Wait for completion (takes 5-10 minutes)
```

### Step 4: Verify Deployment

```bash
# Check if application is running
pm2 status

# View application logs
pm2 logs azproud

# Test the endpoint
curl https://proud.azab.services/

# Check SSL certificate
openssl s_client -connect proud.azab.services:443
```

---

## Manual Steps (if needed)

### If Deployment Script Fails

Follow these steps manually:

#### 1. Clone Repository

```bash
cd /home/ubuntu
sudo -u ubuntu git clone https://github.com/uberfiix/az-product.git azproud
cd azproud
```

#### 2. Install Dependencies

```bash
# Using npm
sudo -u ubuntu npm ci

# Or using Bun (if installed)
# bun install
```

#### 3. Create Environment File

```bash
sudo -u ubuntu cp .env.production.example .env.production
sudo nano .env.production  # Edit with actual values
```

#### 4. Build Application

```bash
sudo -u ubuntu npm run build
```

#### 5. Setup PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem file (copy from deployment script)
sudo -u ubuntu nano ecosystem.config.js

# Start application
cd /home/ubuntu/azproud
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 6. Configure Nginx

```bash
# Copy nginx configuration
sudo nano /etc/nginx/sites-available/proud.azab.services

# Enable site
sudo ln -s /etc/nginx/sites-available/proud.azab.services \
           /etc/nginx/sites-enabled/proud.azab.services

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 7. Setup SSL Certificate

```bash
# Get certificate using Certbot
sudo certbot certonly --nginx \
    -d proud.azab.services \
    -d www.proud.azab.services \
    -m admin@azab.services

# Configure auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## Verification

### Health Checks

```bash
# 1. Check if application is running
pm2 status

# 2. Check if Nginx is running
systemctl status nginx

# 3. Test HTTP endpoint
curl -I https://proud.azab.services

# 4. Check SSL certificate
openssl s_client -connect proud.azab.services:443 -showcerts

# 5. View application logs
pm2 logs azproud --lines 50

# 6. Monitor system resources
htop

# 7. Check disk usage
df -h
```

### Functional Tests

```bash
# Test login page
curl https://proud.azab.services/ -L

# Test API endpoint
curl https://proud.azab.services/api/health

# Test with browser
firefox https://proud.azab.services
# or
chrome https://proud.azab.services
```

---

## Monitoring & Maintenance

### View Logs

```bash
# Real-time application logs
pm2 logs azproud

# Nginx access logs
tail -f /var/log/nginx/azproud-access.log

# Nginx error logs
tail -f /var/log/nginx/azproud-error.log

# System logs
journalctl -u azproud.service -f
```

### Process Management

```bash
# View PM2 status
pm2 status

# Restart application
pm2 restart azproud

# Stop application
pm2 stop azproud

# Start application
pm2 start azproud

# View detailed logs
pm2 logs azproud
```

### Update Application

```bash
# Navigate to app directory
cd /home/ubuntu/azproud

# Pull latest changes
git pull origin main

# Rebuild
npm run build

# Restart application
pm2 reload azproud
```

### Backup Database

```bash
# Supabase backups are automatic, but you can create manual backups:
# 1. Go to Supabase dashboard
# 2. Project Settings → Backups
# 3. Click "Create Backup"

# Or via CLI:
# supabase db push  # Push migrations
# supabase db pull  # Pull latest schema
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check logs
pm2 logs azproud

# Check environment variables
env | grep VITE
env | grep SUPABASE

# Verify Node.js version
node --version

# Try restarting
pm2 restart azproud
```

### Nginx Issues

```bash
# Check syntax
sudo nginx -t

# Check if port 80/443 is in use
sudo netstat -tlnp | grep -E ':(80|443)'

# View detailed error logs
sudo tail -100 /var/log/nginx/error.log
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Check expiration
openssl x509 -in /etc/letsencrypt/live/proud.azab.services/fullchain.pem -text -noout | grep -A2 "Validity"
```

### High Memory Usage

```bash
# Check memory usage
free -h

# View process memory
pm2 monit

# Increase Node.js memory limit in ecosystem.config.js
# max_memory_restart: "1G"
```

### Connection Refused

```bash
# Check if app is running
pm2 status

# Check if Nginx is running
systemctl status nginx

# Test connection to app
curl -I http://127.0.0.1:3000

# Check firewall rules
sudo ufw status
```

### DNS Issues

```bash
# Test DNS resolution
nslookup proud.azab.services
dig proud.azab.services

# Verify A record
dig proud.azab.services +short

# Check with multiple DNS servers
nslookup proud.azab.services 8.8.8.8
```

### Performance Issues

```bash
# Monitor system resources
top
htop
watch -n 1 'free -h && echo "---" && pm2 status'

# Check database connections
# In Supabase dashboard → Database → Connections

# Check for error logs
pm2 logs azproud --err
```

---

## Maintenance Schedule

### Daily

- Monitor application logs
- Check system resources (CPU, RAM, disk)
- Monitor error rates

### Weekly

- Review application performance metrics
- Check SSL certificate expiration
- Update system packages: `sudo apt-get update && apt-get upgrade`

### Monthly

- Review and optimize database queries
- Update Node.js packages: `npm update`
- Full system backup

### Quarterly

- Security audit
- Performance optimization
- Dependency updates: `npm audit fix`

---

## Emergency Recovery

### Restart Application

```bash
pm2 restart azproud
```

### Restart Nginx

```bash
sudo systemctl restart nginx
```

### Full Service Restart

```bash
# Stop application
pm2 stop azproud

# Restart Nginx
sudo systemctl restart nginx

# Start application
pm2 start azproud
```

### Rollback to Previous Version

```bash
cd /home/ubuntu/azproud

# View git history
git log --oneline -10

# Checkout previous version
git checkout <commit-hash>

# Rebuild
npm run build

# Restart
pm2 reload azproud
```

### Emergency DNS Switch

If you need to temporarily switch to a different server:

```bash
# Update DNS A record to point to new server IP
# Wait 5-10 minutes for propagation
# Verify with: nslookup proud.azab.services
```

---

## Support & Resources

- **Repository**: https://github.com/uberfiix/az-product
- **Documentation**: `/docs` directory
- **Issues**: GitHub Issues
- **Contact**: admin@azab.services

---

## Deployment Checklist

- [ ] Server prerequisites installed
- [ ] DNS configured
- [ ] Environment file created with actual values
- [ ] Deployment script executed successfully
- [ ] SSL certificate installed
- [ ] Application running (pm2 status)
- [ ] Nginx configured and running
- [ ] Domain accessible via HTTPS
- [ ] Database connection verified
- [ ] Logs being generated
- [ ] Monitoring setup
- [ ] Backup strategy in place
- [ ] Team trained on operations

---

Last Updated: 2026-05-22
Domain: proud.azab.services
Application: AzProud
