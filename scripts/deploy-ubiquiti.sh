#!/bin/bash

###############################################################################
#                                                                             #
#  AzProud Production Deployment Script for Ubiquiti 24                      #
#  Domain: proud.azab.services                                               #
#                                                                             #
#  This script handles:                                                       #
#  - Cloning/updating the repository                                         #
#  - Installing dependencies                                                 #
#  - Building the application                                                #
#  - Setting up Nginx reverse proxy                                          #
#  - SSL/TLS certificate configuration                                       #
#  - Starting the application with PM2                                       #
#  - Setting up monitoring and logging                                       #
#                                                                             #
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="proud.azab.services"
APP_NAME="azproud"
APP_DIR="/home/ubuntu/azproud"
REPO_URL="https://github.com/uberfiix/az-product.git"
REPO_BRANCH="main"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
APP_PORT=3000
NODE_ENV="production"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

###############################################################################
# SECTION 1: Pre-deployment checks
###############################################################################

print_info "Starting AzProud deployment to $DOMAIN..."
print_info "This script will deploy to: $APP_DIR"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root"
    exit 1
fi

print_info "Checking prerequisites..."

# Check for required tools
required_tools=("git" "nginx" "node" "npm")
missing_tools=()

for tool in "${required_tools[@]}"; do
    if ! command_exists "$tool"; then
        missing_tools+=("$tool")
    fi
done

if [ ${#missing_tools[@]} -gt 0 ]; then
    print_error "Missing required tools: ${missing_tools[*]}"
    print_info "Please install missing tools and try again"
    exit 1
fi

print_success "All prerequisites found"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ is required, but version $(node -v) is installed"
    exit 1
fi

print_success "Node.js version: $(node -v)"
print_success "npm version: $(npm -v)"

###############################################################################
# SECTION 2: Repository setup
###############################################################################

print_info "Setting up repository..."

if [ -d "$APP_DIR" ]; then
    print_info "Directory exists, updating repository..."
    cd "$APP_DIR"
    git fetch origin
    git checkout $REPO_BRANCH
    git pull origin $REPO_BRANCH
else
    print_info "Cloning repository..."
    git clone --branch $REPO_BRANCH $REPO_URL $APP_DIR
    cd "$APP_DIR"
fi

print_success "Repository ready at $APP_DIR"

###############################################################################
# SECTION 3: Install dependencies
###############################################################################

print_info "Installing dependencies..."

# Check if bun is available, if not use npm
if command_exists bun; then
    print_info "Using Bun package manager"
    bun install
else
    print_info "Using npm package manager"
    npm ci --production=false
fi

print_success "Dependencies installed"

###############################################################################
# SECTION 4: Environment configuration
###############################################################################

print_info "Setting up environment variables..."

if [ ! -f "$APP_DIR/.env.production" ]; then
    print_warning ".env.production not found"
    print_info "Please create $APP_DIR/.env.production with the following variables:"
    cat << 'EOF'
    
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Azure OpenAI
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint

# API Configuration
VITE_API_URL=https://proud.azab.services/api
NODE_ENV=production

# Daftra Integration (optional)
DAFTRA_API_KEY=your_daftra_key
DAFTRA_DOMAIN=your_daftra_domain

# Application
APP_PORT=3000
APP_HOST=0.0.0.0

EOF
    exit 1
fi

print_success "Environment file configured"

###############################################################################
# SECTION 5: Build application
###############################################################################

print_info "Building application..."

if command_exists bun; then
    bun run build
else
    npm run build
fi

if [ ! -d "$APP_DIR/dist" ]; then
    print_error "Build failed - dist directory not found"
    exit 1
fi

print_success "Application built successfully"

###############################################################################
# SECTION 6: Install PM2 globally
###############################################################################

print_info "Setting up PM2 process manager..."

if ! command_exists pm2; then
    print_info "Installing PM2 globally..."
    npm install -g pm2
fi

# Create PM2 ecosystem file
cat > "$APP_DIR/ecosystem.config.js" << 'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name: "azproud",
      script: "./dist/server/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        APP_PORT: 3000,
      },
      watch: false,
      ignore_watch: ["node_modules", "dist"],
      max_memory_restart: "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      
      // Auto restart
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      
      // Environment specific
      merge_logs: true,
    },
  ],
};
ECOSYSTEM

print_success "PM2 ecosystem configured"

###############################################################################
# SECTION 7: Create systemd service
###############################################################################

print_info "Creating systemd service file..."

cat > "/etc/systemd/system/azproud.service" << 'SERVICE'
[Unit]
Description=AzProud Application
After=network.target

[Service]
Type=forking
User=ubuntu
WorkingDirectory=/home/ubuntu/azproud
Environment="PATH=/usr/local/bin:/usr/bin"
ExecStart=/usr/local/bin/pm2 start ecosystem.config.js --name azproud
ExecReload=/usr/local/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/local/bin/pm2 stop ecosystem.config.js
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
SERVICE

chmod 644 /etc/systemd/system/azproud.service
systemctl daemon-reload

print_success "Systemd service created"

###############################################################################
# SECTION 8: Configure Nginx
###############################################################################

print_info "Configuring Nginx reverse proxy..."

# Create nginx configuration
cat > "$NGINX_CONFIG" << 'NGINX'
upstream azproud_app {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 64;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

server {
    listen 80;
    listen [::]:80;
    server_name proud.azab.services www.proud.azab.services;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name proud.azab.services;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/proud.azab.services/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/proud.azab.services/privkey.pem;
    
    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Logging
    access_log /var/log/nginx/azproud-access.log combined;
    error_log /var/log/nginx/azproud-error.log warn;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Client limits
    client_max_body_size 50M;
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    root /home/ubuntu/azproud/dist;

    # Static files with cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        
        proxy_pass http://azproud_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Auth endpoints with stricter rate limiting
    location /auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        
        proxy_pass http://azproud_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for real-time features
    location /ws/ {
        proxy_pass http://azproud_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # All other routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
        
        proxy_pass http://azproud_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect www to non-www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.proud.azab.services;

    ssl_certificate /etc/letsencrypt/live/proud.azab.services/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/proud.azab.services/privkey.pem;

    return 301 https://proud.azab.services$request_uri;
}
NGINX

# Enable the site
if [ -L "/etc/nginx/sites-enabled/$DOMAIN" ]; then
    rm "/etc/nginx/sites-enabled/$DOMAIN"
fi
ln -s "$NGINX_CONFIG" "/etc/nginx/sites-enabled/$DOMAIN"

# Test Nginx configuration
if ! nginx -t; then
    print_error "Nginx configuration test failed"
    exit 1
fi

print_success "Nginx configured successfully"

###############################################################################
# SECTION 9: SSL/TLS Setup
###############################################################################

print_info "Setting up SSL/TLS with Let's Encrypt..."

if command_exists certbot; then
    print_info "Certbot found, checking certificates..."
    
    if [ ! -d "/etc/letsencrypt/live/proud.azab.services" ]; then
        print_info "Creating new certificate..."
        certbot certonly --nginx --non-interactive --agree-tos \
            -d proud.azab.services \
            -d www.proud.azab.services \
            -m "admin@azab.services" || print_warning "Certificate setup may require manual intervention"
    else
        print_info "Certificate already exists"
    fi
    
    # Setup auto-renewal
    certbot renew --dry-run || true
else
    print_warning "Certbot not found. Installing..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx
    
    certbot certonly --nginx --non-interactive --agree-tos \
        -d proud.azab.services \
        -d www.proud.azab.services \
        -m "admin@azab.services" || print_warning "Certificate setup may require manual intervention"
fi

print_success "SSL/TLS configured"

###############################################################################
# SECTION 10: Start application
###############################################################################

print_info "Starting AzProud application..."

# Stop existing PM2 process if running
pm2 stop azproud 2>/dev/null || true
pm2 delete azproud 2>/dev/null || true

# Start application
cd "$APP_DIR"
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu || true

print_success "Application started with PM2"

###############################################################################
# SECTION 11: Setup logging and monitoring
###############################################################################

print_info "Setting up logging..."

# Create logs directory
mkdir -p "$APP_DIR/logs"
chown -R ubuntu:ubuntu "$APP_DIR/logs"

# Create logrotate configuration
cat > "/etc/logrotate.d/azproud" << 'LOGROTATE'
/home/ubuntu/azproud/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reload azproud > /dev/null 2>&1 || true
    endscript
}

/var/log/nginx/azproud-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        nginx -s reload > /dev/null 2>&1 || true
    endscript
}
LOGROTATE

print_success "Logging configured"

###############################################################################
# SECTION 12: Verify deployment
###############################################################################

print_info "Verifying deployment..."

sleep 3

# Check if app is running
if pm2 list | grep -q "azproud"; then
    print_success "Application is running"
else
    print_error "Application failed to start"
    pm2 logs azproud --lines 20
    exit 1
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running"
    exit 1
fi

# Test HTTP endpoint
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "307" ]; then
    print_success "Application responding correctly (HTTP $RESPONSE)"
else
    print_warning "Application returned HTTP $RESPONSE"
fi

###############################################################################
# SECTION 13: Post-deployment tasks
###############################################################################

print_info "Running post-deployment tasks..."

# Enable and start Nginx
systemctl enable nginx
systemctl restart nginx

# Enable systemd service
systemctl enable azproud.service

# Create backup directory
mkdir -p /home/ubuntu/backups
chown ubuntu:ubuntu /home/ubuntu/backups

print_success "Post-deployment tasks completed"

###############################################################################
# SECTION 14: Final summary
###############################################################################

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment Completed Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Domain:          ${BLUE}https://proud.azab.services${NC}"
echo -e "Application:     ${BLUE}$APP_NAME${NC}"
echo -e "Directory:       ${BLUE}$APP_DIR${NC}"
echo -e "Process Manager: ${BLUE}PM2${NC}"
echo -e "Web Server:      ${BLUE}Nginx${NC}"
echo -e "SSL:             ${BLUE}Let's Encrypt${NC}"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs:              pm2 logs azproud"
echo "  Restart app:            pm2 restart azproud"
echo "  Stop app:               pm2 stop azproud"
echo "  View app status:        pm2 status"
echo "  Nginx reload:           sudo systemctl reload nginx"
echo "  View error logs:        tail -f /var/log/nginx/azproud-error.log"
echo ""
echo -e "${YELLOW}Health Checks:${NC}"
echo "  Website:                curl https://proud.azab.services"
echo "  Check SSL:              openssl s_client -connect proud.azab.services:443"
echo "  Monitor app:            watch -n 1 'pm2 status && echo && pm2 logs --lines 5'"
echo ""
echo -e "${YELLOW}Maintenance:${NC}"
echo "  Auto-backup daily:      crontab -e"
echo "  Check updates:          cd $APP_DIR && git status"
echo "  Deploy updates:         cd $APP_DIR && git pull && bun run build && pm2 reload azproud"
echo ""
echo -e "${GREEN}Deployment Date: $(date)${NC}"
echo ""
