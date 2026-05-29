# 🚀 AzProud Deployment to Ubiquiti 24

**Domain:** proud.azab.services  
**Status:** ✅ Ready for Production Deployment

---

## 📦 Deployment Packages

### What You Have

✅ **Automated Deployment Script** (`scripts/deploy-ubiquiti.sh`)
- One-command deployment to Ubiquiti 24
- Handles all setup automatically
- Includes SSL/TLS, PM2, Nginx configuration

✅ **Environment Configuration** (`.env.production.example`)
- Template with all required variables
- Copy and customize with your credentials
- Well-documented for each setting

✅ **Comprehensive Guides**
- `docs/UBIQUITI_DEPLOYMENT.md` - Complete step-by-step guide
- `UBIQUITI_DEPLOYMENT_SUMMARY.md` - Quick reference

✅ **Management Scripts**
- `scripts/update-app.sh` - Easy updates
- `scripts/backup-restore.sh` - Backup and recovery

---

## ⚡ Quick Deployment (5-10 minutes)

### Prerequisites
- Ubuntu 20.04+ server with sudo access
- Domain `proud.azab.services` pointing to server IP
- Supabase project and credentials ready
- Azure OpenAI credentials (if using AI features)

### Step 1: Connect to Server
```bash
ssh ubuntu@proud.azab.services
```

### Step 2: Update System
```bash
sudo apt-get update && sudo apt-get upgrade -y
```

### Step 3: Clone Repository
```bash
cd /tmp
git clone https://github.com/uberfiix/az-product.git
cd az-product
```

### Step 4: Prepare Environment
```bash
# Copy template
cp .env.production.example /tmp/.env.production

# Edit with your credentials
nano /tmp/.env.production

# Required to fill:
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=your-key-here
# SUPABASE_SERVICE_ROLE_KEY=your-key-here
# AZURE_OPENAI_API_KEY=your-key-here
# AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com/
```

### Step 5: Deploy
```bash
# Make script executable
chmod +x scripts/deploy-ubiquiti.sh

# Run deployment (requires sudo)
sudo scripts/deploy-ubiquiti.sh
```

### Step 6: Verify
```bash
# Check status
pm2 status

# View logs
pm2 logs azproud

# Test website
curl https://proud.azab.services/
```

---

## 📚 Detailed Documentation

For complete information, see:
- **Full Deployment Guide:** `docs/UBIQUITI_DEPLOYMENT.md`
- **Quick Reference:** `UBIQUITI_DEPLOYMENT_SUMMARY.md`
- **Troubleshooting:** See relevant section below

---

## 🎯 What Gets Installed

✅ **Application**
- Node.js application in `/home/ubuntu/azproud`
- Built with Vite (fast SSR)
- Optimized production bundle

✅ **Process Manager**
- PM2 for process management
- Auto-restart on crash
- Cluster mode for multiple cores
- Real-time monitoring

✅ **Web Server**
- Nginx reverse proxy
- Gzip compression
- Static file caching
- Rate limiting
- Security headers

✅ **SSL/TLS**
- Let's Encrypt certificate
- Automatic renewal
- TLS 1.2 & 1.3 only

✅ **Monitoring**
- PM2 logs and monitoring
- Nginx access/error logs
- Systemd service integration

✅ **Backups**
- Automatic daily backups
- Backup retention (30 days)
- Easy restore procedure

---

## 🛠️ Post-Deployment Management

### View Application Status
```bash
pm2 status
pm2 logs azproud
pm2 monit
```

### Restart Application
```bash
pm2 restart azproud
```

### Update Application
```bash
cd /home/ubuntu/azproud
./scripts/update-app.sh
```

### Create Backup
```bash
./scripts/backup-restore.sh backup
```

### Restore from Backup
```bash
./scripts/backup-restore.sh restore app-20260522-120000.tar.gz
```

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Access https://proud.azab.services in browser
- [ ] Can see login page
- [ ] SSL certificate is valid
- [ ] No browser warnings
- [ ] `pm2 status` shows "online"
- [ ] `pm2 logs azproud` shows no errors
- [ ] `curl https://proud.azab.services` returns 200
- [ ] Nginx is running: `sudo systemctl status nginx`
- [ ] Application directory exists: `/home/ubuntu/azproud`
- [ ] Backups directory exists: `/home/ubuntu/backups`

---

## 🚨 Troubleshooting

### Application Won't Start
```bash
pm2 logs azproud
# Check environment variables
env | grep VITE_
# Check Node.js version (need 18+)
node --version
```

### SSL Certificate Error
```bash
# Check certificate
sudo certbot certificates
# Renew if needed
sudo certbot renew --force-renewal
```

### Website Not Accessible
```bash
# Check Nginx
sudo systemctl status nginx
# Test configuration
sudo nginx -t
# Check DNS
nslookup proud.azab.services
```

### High Memory Usage
```bash
# Monitor
pm2 monit
htop

# Increase memory limit in ecosystem.config.js
# max_memory_restart: "1G"
```

See `docs/UBIQUITI_DEPLOYMENT.md` for more troubleshooting steps.

---

## 📊 Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB | 50 GB |
| Bandwidth | 1 Mbps | 10 Mbps |

---

## 🔐 Security Checklist

✅ HTTPS/SSL enabled  
✅ Rate limiting configured  
✅ Security headers set  
✅ Environment variables secured  
✅ Database RLS enabled  
✅ Regular backups running  
✅ Log monitoring active  
✅ Auto-security updates  

---

## 📅 Maintenance

### Daily
- Monitor logs: `pm2 logs azproud`
- Check status: `pm2 status`

### Weekly
- Review error logs
- Update system: `sudo apt-get update && upgrade`

### Monthly
- Full backup
- Database optimization
- Security audit

### Quarterly
- Dependency updates: `npm audit fix`
- Performance review

---

## 🎓 Useful Commands

```bash
# View logs (real-time)
pm2 logs azproud

# Monitor resources
pm2 monit

# Restart application
pm2 restart azproud

# Stop/start application
pm2 stop azproud
pm2 start azproud

# Reload configuration
sudo systemctl reload nginx

# View Nginx logs
tail -f /var/log/nginx/azproud-access.log
tail -f /var/log/nginx/azproud-error.log

# Check disk usage
df -h

# Check system load
uptime
```

---

## 📞 Support

- **Documentation:** See `/docs` directory
- **Issues:** GitHub Issues
- **Repository:** https://github.com/uberfiix/az-product
- **Email:** admin@azab.services

---

## ✨ Success!

Once deployed, your AzProud application will be:

✅ **Accessible at:** https://proud.azab.services  
✅ **Secure:** SSL/TLS encrypted  
✅ **Fast:** Optimized with caching  
✅ **Reliable:** Auto-restart on crash  
✅ **Monitored:** Logs and metrics  
✅ **Backed up:** Daily automatic backups  

You're ready to launch! 🚀

---

**Created:** 2026-05-22  
**Status:** ✅ Production Ready  
**Domain:** proud.azab.services
