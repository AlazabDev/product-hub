#!/bin/bash

###############################################################################
#                                                                             #
#  AzProud Application Update Script                                         #
#  For Ubiquiti 24 Server                                                    #
#                                                                             #
#  This script:                                                               #
#  - Pulls latest changes from repository                                    #
#  - Installs any new dependencies                                           #
#  - Rebuilds the application                                                #
#  - Reloads the PM2 process gracefully                                      #
#  - Verifies deployment                                                     #
#                                                                             #
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="/home/ubuntu/azproud"
REPO_BRANCH="main"

# Functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

###############################################################################
# SECTION 1: Pre-update checks
###############################################################################

print_info "Starting application update..."

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    print_error "Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Check git status
if [ ! -d ".git" ]; then
    print_error "Not a git repository"
    exit 1
fi

print_info "Checking for pending changes..."
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Uncommitted changes detected"
    git status --short
    echo "Continue with update? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        print_warning "Update cancelled"
        exit 0
    fi
fi

###############################################################################
# SECTION 2: Backup current state
###############################################################################

print_info "Creating backup of current state..."

BACKUP_DIR="/home/ubuntu/backups"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    -C "$APP_DIR" . 2>/dev/null || true

print_success "Backup created: $BACKUP_NAME"

###############################################################################
# SECTION 3: Pull latest changes
###############################################################################

print_info "Fetching latest changes from repository..."

git fetch origin
git checkout $REPO_BRANCH
git pull origin $REPO_BRANCH

print_success "Repository updated"

###############################################################################
# SECTION 4: Install dependencies
###############################################################################

print_info "Installing dependencies..."

if command -v bun &>/dev/null; then
    print_info "Using Bun package manager"
    bun install
else
    print_info "Using npm package manager"
    npm ci
fi

print_success "Dependencies installed"

###############################################################################
# SECTION 5: Build application
###############################################################################

print_info "Building application..."

if command -v bun &>/dev/null; then
    bun run build
else
    npm run build
fi

if [ ! -d "dist" ]; then
    print_error "Build failed - dist directory not created"
    exit 1
fi

print_success "Application built successfully"

###############################################################################
# SECTION 6: Verify build integrity
###############################################################################

print_info "Verifying build..."

# Check if essential files exist
required_files=("dist/index.html" "dist/assets")
for file in "${required_files[@]}"; do
    if [ ! -e "$file" ]; then
        print_error "Build verification failed - missing $file"
        exit 1
    fi
done

print_success "Build verification passed"

###############################################################################
# SECTION 7: Graceful reload
###############################################################################

print_info "Reloading application with PM2..."

pm2 reload azproud --update-env

sleep 3

# Verify reload
if ! pm2 list | grep -q "azproud.*online"; then
    print_warning "PM2 reload completed, but status unclear"
    pm2 logs azproud --lines 10
else
    print_success "Application reloaded successfully"
fi

###############################################################################
# SECTION 8: Post-update verification
###############################################################################

print_info "Verifying deployment..."

sleep 2

# Test HTTP endpoint
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://proud.azab.services/)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "301" ]; then
    print_success "Application responding correctly (HTTP $RESPONSE)"
else
    print_error "Application returned unexpected HTTP $RESPONSE"
    print_info "Rolling back to previous backup..."
    
    # Rollback procedure
    cd "$APP_DIR"
    git reset --hard HEAD~1
    npm ci
    npm run build
    pm2 reload azproud
    
    print_warning "Rolled back to previous version"
    exit 1
fi

###############################################################################
# SECTION 9: Log rotation
###############################################################################

print_info "Rotating logs if needed..."

# Manually rotate logs if they're too large
for logfile in "$APP_DIR/logs"/*.log; do
    if [ -f "$logfile" ]; then
        SIZE=$(du -b "$logfile" | cut -f1)
        MAX_SIZE=$((100 * 1024 * 1024)) # 100MB
        
        if [ $SIZE -gt $MAX_SIZE ]; then
            mv "$logfile" "$logfile.old"
            gzip "$logfile.old"
            print_info "Rotated $logfile"
        fi
    fi
done

###############################################################################
# SECTION 10: Summary
###############################################################################

print_info "Getting current status..."
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Update Completed Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

pm2 status | grep azproud

echo ""
print_info "Recent logs:"
pm2 logs azproud --lines 5 --nostream | tail -5

echo ""
print_success "Update completed at $(date)"
print_info "Backup location: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
print_info "To rollback: git reset --hard HEAD~1 && npm run build && pm2 reload azproud"
echo ""
