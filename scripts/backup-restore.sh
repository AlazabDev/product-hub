#!/bin/bash

###############################################################################
#                                                                             #
#  AzProud Backup and Restore Script                                        #
#  For Ubiquiti 24 Server                                                    #
#                                                                             #
#  Usage:                                                                    #
#  ./backup-restore.sh backup              - Create full backup              #
#  ./backup-restore.sh restore <backup>    - Restore from backup             #
#  ./backup-restore.sh list                - List all backups                #
#  ./backup-restore.sh cleanup             - Remove old backups              #
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
BACKUP_DIR="/home/ubuntu/backups"
BACKUP_RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

###############################################################################
# SECTION 1: Validate arguments
###############################################################################

if [ -z "$1" ]; then
    echo "Usage: $0 {backup|restore|list|cleanup|schedule}"
    echo ""
    echo "Commands:"
    echo "  backup              - Create full backup of application and database"
    echo "  restore <file>      - Restore from specific backup file"
    echo "  list                - List all available backups"
    echo "  cleanup             - Remove backups older than $BACKUP_RETENTION_DAYS days"
    echo "  schedule            - Setup automatic daily backups (cron)"
    echo ""
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

###############################################################################
# SECTION 2: BACKUP FUNCTION
###############################################################################

backup_application() {
    print_info "Starting application backup..."
    
    # Check if app is running
    if ! pm2 list | grep -q "azproud"; then
        print_warning "Application is not running"
    fi
    
    # Backup app files
    print_info "Backing up application files..."
    tar -czf "$BACKUP_DIR/app-$TIMESTAMP.tar.gz" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist/node_modules \
        -C "$APP_DIR" . 2>/dev/null
    
    print_success "Application backup created: app-$TIMESTAMP.tar.gz"
    
    # Backup database from Supabase
    print_info "Backing up Supabase database..."
    # Note: This requires supabase CLI and credentials
    # For now, we just provide instructions
    cat > "$BACKUP_DIR/db-backup-$TIMESTAMP.sql" << 'EOF'
-- Supabase Database Backup
-- To create a SQL backup:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run: SELECT * FROM products, suppliers, integrations, etc.
-- 3. Export to SQL file
-- Or use: pg_dump -U postgres -h db.your-project.supabase.co
EOF
    
    print_warning "Database backup instructions saved"
    print_info "To backup Supabase: Go to Supabase Dashboard > Project Settings > Backups"
    
    # Create metadata file
    cat > "$BACKUP_DIR/backup-$TIMESTAMP.metadata" << METADATA
Backup Metadata
==============
Timestamp: $TIMESTAMP
Application: AzProud
Directory: $APP_DIR
Files included:
  - Application code
  - Configuration files
  - Environment variables (if .env.production is in tar)
  - Logs directory
  - PM2 ecosystem config

Not included:
  - node_modules (reinstalled on restore)
  - dist directory (rebuilt on restore)
  - Git history (use git for version control)

Restore command:
  cd /tmp
  tar -xzf $BACKUP_DIR/app-$TIMESTAMP.tar.gz
  
Database backup:
  See db-backup-$TIMESTAMP.sql for database instructions
METADATA
    
    # List backup files created
    echo ""
    print_info "Backup files created:"
    ls -lh "$BACKUP_DIR"/app-$TIMESTAMP.tar.gz
    ls -lh "$BACKUP_DIR"/backup-$TIMESTAMP.metadata
    
    print_success "Backup completed at $(date)"
    echo ""
}

###############################################################################
# SECTION 3: RESTORE FUNCTION
###############################################################################

restore_application() {
    BACKUP_FILE=$2
    
    if [ -z "$BACKUP_FILE" ]; then
        print_error "Please specify backup file to restore"
        print_info "Available backups:"
        list_backups
        exit 1
    fi
    
    if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
        exit 1
    fi
    
    print_warning "This will OVERWRITE the current application!"
    echo "Restoring from: $BACKUP_FILE"
    echo "Press Ctrl+C to cancel, or press Enter to continue..."
    read -r
    
    # Backup current state before restoring
    print_info "Creating safety backup of current state..."
    tar -czf "$BACKUP_DIR/pre-restore-$TIMESTAMP.tar.gz" \
        --exclude=node_modules \
        -C "$APP_DIR" . 2>/dev/null
    print_success "Safety backup created: pre-restore-$TIMESTAMP.tar.gz"
    
    # Stop application
    print_info "Stopping application..."
    pm2 stop azproud || true
    
    # Extract backup
    print_info "Extracting backup files..."
    cd "$APP_DIR"
    tar -xzf "$BACKUP_DIR/$BACKUP_FILE"
    
    # Reinstall dependencies
    print_info "Installing dependencies..."
    if command -v bun &>/dev/null; then
        bun install
    else
        npm ci
    fi
    
    # Rebuild
    print_info "Rebuilding application..."
    if command -v bun &>/dev/null; then
        bun run build
    else
        npm run build
    fi
    
    # Start application
    print_info "Starting application..."
    pm2 start azproud || pm2 restart azproud
    
    sleep 3
    
    # Verify
    print_info "Verifying restoration..."
    if pm2 list | grep -q "azproud.*online"; then
        print_success "Application restored and running"
    else
        print_error "Application failed to start after restore"
        print_info "Rolling back to pre-restore state..."
        tar -xzf "$BACKUP_DIR/pre-restore-$TIMESTAMP.tar.gz"
        npm ci
        npm run build
        pm2 restart azproud
        exit 1
    fi
    
    echo ""
    print_success "Restore completed successfully"
    print_info "Safety backup saved as: pre-restore-$TIMESTAMP.tar.gz"
    echo ""
}

###############################################################################
# SECTION 4: LIST BACKUPS FUNCTION
###############################################################################

list_backups() {
    print_info "Available backups:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        print_warning "No backups found"
        return
    fi
    
    echo "Application Backups:"
    ls -lh "$BACKUP_DIR"/app-*.tar.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}' || echo "  None"
    
    echo ""
    echo "Metadata Files:"
    ls -lh "$BACKUP_DIR"/*.metadata 2>/dev/null | awk '{print $9}' || echo "  None"
    
    echo ""
    print_info "Total backup size: $(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)"
    echo ""
}

###############################################################################
# SECTION 5: CLEANUP OLD BACKUPS FUNCTION
###############################################################################

cleanup_old_backups() {
    print_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "app-*.tar.gz" -mtime +$BACKUP_RETENTION_DAYS -exec rm {} \;
    find "$BACKUP_DIR" -name "backup-*.metadata" -mtime +$BACKUP_RETENTION_DAYS -exec rm {} \;
    
    print_success "Cleanup completed"
    
    print_info "Current backup status:"
    list_backups
}

###############################################################################
# SECTION 6: SCHEDULE BACKUPS FUNCTION
###############################################################################

schedule_backups() {
    print_info "Setting up automatic daily backups..."
    
    # Create backup script that can be called from cron
    CRON_SCRIPT="$BACKUP_DIR/daily-backup.sh"
    
    cat > "$CRON_SCRIPT" << 'CRONSCRIPT'
#!/bin/bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root

# Run backup
$0 backup

# Cleanup old backups
$0 cleanup

# Log the operation
echo "Backup completed at $(date)" >> /home/ubuntu/backups/backup.log
CRONSCRIPT
    
    chmod +x "$CRON_SCRIPT"
    
    # Add to crontab
    CRON_JOB="0 2 * * * /home/ubuntu/azproud/scripts/backup-restore.sh backup > /home/ubuntu/backups/backup.log 2>&1"
    
    # Check if already exists
    if crontab -l 2>/dev/null | grep -q "backup-restore.sh backup"; then
        print_warning "Backup cron job already exists"
    else
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        print_success "Cron job added: Daily backup at 2 AM"
    fi
    
    echo ""
    print_info "Backup schedule:"
    crontab -l | grep backup-restore || echo "No backup cron job found"
    echo ""
}

###############################################################################
# SECTION 7: MAIN COMMAND HANDLER
###############################################################################

case "$1" in
    backup)
        backup_application
        ;;
    restore)
        restore_application "$@"
        ;;
    list)
        list_backups
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    schedule)
        schedule_backups
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use: $0 {backup|restore|list|cleanup|schedule}"
        exit 1
        ;;
esac
