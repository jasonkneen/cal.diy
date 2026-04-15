#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Cal.diy One-Click Deployment Script
# Deploy a full scheduling platform in 90 seconds
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Default configuration
DEFAULT_PORT=3000
DEFAULT_API_PORT=3002
DEFAULT_DB_PORT=5432
DEFAULT_REDIS_PORT=6379
COMPOSE_FILE="docker-compose.yml"

# ============================================================================
# Helper functions
# ============================================================================

log_info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
log_error()   { echo -e "${RED}❌${NC} $1"; }
log_step()    { echo -e "\n${CYAN}${BOLD}▸ $1${NC}"; }

generate_secret() {
  # Generate a cryptographically random string
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  elif command -v python3 &>/dev/null; then
    python3 -c "import secrets; print(secrets.token_hex(32))"
  else
    head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c 64
  fi
}

generate_password() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 24 | tr -d '/+=' | head -c 24
  else
    head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 24
  fi
}

check_command() {
  if ! command -v "$1" &>/dev/null; then
    return 1
  fi
  return 0
}

banner() {
  echo -e "${CYAN}${BOLD}"
  cat << 'EOF'

   ██████╗ █████╗ ██╗        ██████╗ ██╗██╗   ██╗
  ██╔════╝██╔══██╗██║        ██╔══██╗██║╚██╗ ██╔╝
  ██║     ███████║██║        ██║  ██║██║ ╚████╔╝
  ██║     ██╔══██║██║        ██║  ██║██║  ╚██╔╝
  ╚██████╗██║  ██║███████╗██╗██████╔╝██║   ██║
   ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚═╝   ╚═╝

  Open Source Scheduling — Deploy in Seconds

EOF
  echo -e "${NC}"
}

# ============================================================================
# Pre-flight checks
# ============================================================================

preflight() {
  log_step "Running pre-flight checks..."

  # Check Docker
  if ! check_command docker; then
    log_error "Docker is not installed."
    echo "  Install it from: https://docs.docker.com/get-docker/"
    exit 1
  fi
  log_success "Docker found: $(docker --version | head -1)"

  # Check Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif check_command docker-compose; then
    COMPOSE_CMD="docker-compose"
  else
    log_error "Docker Compose is not installed."
    echo "  Install it from: https://docs.docker.com/compose/install/"
    exit 1
  fi
  log_success "Docker Compose found: $($COMPOSE_CMD version 2>&1 | head -1)"

  # Check if Docker daemon is running
  if ! docker info &>/dev/null 2>&1; then
    log_error "Docker daemon is not running. Start Docker and try again."
    exit 1
  fi
  log_success "Docker daemon is running"

  # Check available disk space (need at least 5GB)
  local available_gb
  if command -v df &>/dev/null; then
    available_gb=$(df -BG . 2>/dev/null | awk 'NR==2 {gsub(/G/, "", $4); print $4}' || echo "999")
    if [[ "$available_gb" -lt 5 ]]; then
      log_warn "Low disk space: ${available_gb}GB available (recommended: 5GB+)"
    else
      log_success "Disk space: ${available_gb}GB available"
    fi
  fi

  # Check available memory
  if command -v free &>/dev/null; then
    local mem_gb
    mem_gb=$(free -g 2>/dev/null | awk '/Mem:/ {print $2}' || echo "0")
    if [[ "$mem_gb" -lt 2 ]]; then
      log_warn "Low memory: ${mem_gb}GB RAM (recommended: 4GB+)"
    fi
  fi
}

# ============================================================================
# Configuration wizard
# ============================================================================

configure() {
  log_step "Configuring Cal.diy..."

  # Check if .env already exists
  if [[ -f .env ]]; then
    log_warn ".env file already exists."
    read -rp "  Overwrite with fresh configuration? [y/N]: " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
      log_info "Keeping existing .env file"
      return
    fi
  fi

  # Interactive or auto mode
  local mode="auto"
  if [[ "${1:-}" == "--interactive" ]] || [[ "${1:-}" == "-i" ]]; then
    mode="interactive"
  fi

  # Generate secrets
  local nextauth_secret
  local encryption_key
  local db_password
  local webapp_url
  local admin_email

  nextauth_secret=$(generate_secret)
  encryption_key=$(generate_secret)
  db_password=$(generate_password)

  if [[ "$mode" == "interactive" ]]; then
    echo ""
    read -rp "  🌐 Your domain/URL [http://localhost:${DEFAULT_PORT}]: " webapp_url
    webapp_url="${webapp_url:-http://localhost:${DEFAULT_PORT}}"

    read -rp "  📧 Admin email [admin@cal.diy]: " admin_email
    admin_email="${admin_email:-admin@cal.diy}"

    echo ""
    read -rp "  📬 Configure email (SMTP) now? [y/N]: " setup_email
    local smtp_host="" smtp_port="" smtp_user="" smtp_pass="" smtp_from=""
    if [[ "$setup_email" =~ ^[Yy]$ ]]; then
      read -rp "    SMTP Host: " smtp_host
      read -rp "    SMTP Port [587]: " smtp_port
      smtp_port="${smtp_port:-587}"
      read -rp "    SMTP User: " smtp_user
      read -rsp "    SMTP Password: " smtp_pass
      echo ""
      read -rp "    From address [${admin_email}]: " smtp_from
      smtp_from="${smtp_from:-${admin_email}}"
    fi
  else
    webapp_url="http://localhost:${DEFAULT_PORT}"
    admin_email="admin@cal.diy"
  fi

  # Write .env file
  cat > .env << ENVEOF
# ============================================================================
# Cal.diy Configuration — Generated by deploy.sh
# Generated at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# ============================================================================

# --- Core ---
NEXT_PUBLIC_WEBAPP_URL='${webapp_url}'
NEXT_PUBLIC_WEBSITE_URL='${webapp_url}'
NEXT_PUBLIC_EMBED_LIB_URL='${webapp_url}/embed/embed.js'
NEXT_PUBLIC_API_V2_URL='${webapp_url}/api/v2'
NEXTAUTH_URL='${webapp_url}/api/auth'
NEXTAUTH_SECRET='${nextauth_secret}'
CALENDSO_ENCRYPTION_KEY='${encryption_key}'
NEXT_PUBLIC_LICENSE_CONSENT='agree'

# --- Database ---
POSTGRES_USER=caldiy
POSTGRES_PASSWORD='${db_password}'
POSTGRES_DB=caldiy
DATABASE_HOST=database:${DEFAULT_DB_PORT}
DATABASE_URL='postgresql://caldiy:${db_password}@database:${DEFAULT_DB_PORT}/caldiy'
DATABASE_DIRECT_URL='postgresql://caldiy:${db_password}@database:${DEFAULT_DB_PORT}/caldiy'

# --- Redis ---
REDIS_URL='redis://redis:${DEFAULT_REDIS_PORT}'

# --- API ---
API_PORT=${DEFAULT_API_PORT}
API_URL='${webapp_url}/api/v2'
NODE_ENV=production

# --- Email (SMTP) ---
EMAIL_FROM='${smtp_from:-noreply@cal.diy}'
EMAIL_SERVER_HOST='${smtp_host:-}'
EMAIL_SERVER_PORT='${smtp_port:-587}'
EMAIL_SERVER_USER='${smtp_user:-}'
EMAIL_SERVER_PASSWORD='${smtp_pass:-}'

# --- Telemetry (disabled by default for privacy) ---
CALCOM_TELEMETRY_DISABLED=1
NEXT_PUBLIC_IS_E2E=0

# --- Organizations (disabled by default, enable if needed) ---
ORGANIZATIONS_ENABLED=0

# --- Feature Flags ---
# All features unlocked for self-hosted
NEXT_PUBLIC_HOSTED_CAL_FEATURES=1

# --- Allowed Hostnames ---
ALLOWED_HOSTNAMES='"localhost:${DEFAULT_PORT}","$(echo "${webapp_url}" | sed 's|https\?://||')"'
RESERVED_SUBDOMAINS='"app","auth","docs","api","admin"'
ENVEOF

  log_success "Configuration saved to .env"
  log_info "Database password: ${db_password} (saved in .env)"
  log_info "NextAuth secret: auto-generated (saved in .env)"
}

# ============================================================================
# Deploy
# ============================================================================

deploy() {
  log_step "Starting Cal.diy services..."

  # Pull images first (faster than building from source)
  log_info "Pulling Docker images..."
  $COMPOSE_CMD pull database redis 2>/dev/null || true

  # Start services
  $COMPOSE_CMD up -d

  log_success "Containers started"

  # Wait for database to be ready
  log_step "Waiting for database to be ready..."
  local retries=30
  while [[ $retries -gt 0 ]]; do
    if $COMPOSE_CMD exec -T database pg_isready -U caldiy &>/dev/null 2>&1; then
      log_success "Database is ready"
      break
    fi
    retries=$((retries - 1))
    sleep 2
  done

  if [[ $retries -eq 0 ]]; then
    log_error "Database failed to start. Check logs: $COMPOSE_CMD logs database"
    exit 1
  fi

  # Run Prisma migrations
  log_step "Running database migrations..."
  $COMPOSE_CMD exec -T calcom npx prisma migrate deploy 2>&1 || {
    log_warn "Migration may have already been applied or container is still starting."
    log_info "Waiting 10 seconds for app to initialize..."
    sleep 10
  }

  log_success "Database migrations complete"

  # Wait for the web app to be ready
  log_step "Waiting for Cal.diy to start..."
  local app_retries=60
  local webapp_port
  webapp_port=$(grep -oP "NEXT_PUBLIC_WEBAPP_URL=.*:(\d+)" .env | grep -oP '\d+$' || echo "$DEFAULT_PORT")

  while [[ $app_retries -gt 0 ]]; do
    if curl -sf "http://localhost:${webapp_port}/api/auth/providers" &>/dev/null 2>&1; then
      break
    fi
    app_retries=$((app_retries - 1))
    sleep 3
  done

  if [[ $app_retries -eq 0 ]]; then
    log_warn "App may still be starting. Check: $COMPOSE_CMD logs calcom"
  fi
}

# ============================================================================
# Print success
# ============================================================================

print_success() {
  local webapp_url
  webapp_url=$(grep "NEXT_PUBLIC_WEBAPP_URL=" .env | head -1 | cut -d"'" -f2)

  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
  echo -e "${GREEN}${BOLD}║   🎉  Cal.diy is running!                                    ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Web App:${NC}     ${CYAN}${webapp_url}${NC}"
  echo -e "  ${BOLD}API v2:${NC}      ${CYAN}${webapp_url}/api/v2${NC}"
  echo ""
  echo -e "  ${BOLD}First steps:${NC}"
  echo -e "    1. Open ${CYAN}${webapp_url}${NC} in your browser"
  echo -e "    2. Click ${BOLD}Sign Up${NC} to create your admin account"
  echo -e "    3. Connect your calendar (Google, Apple, etc.)"
  echo -e "    4. Create your first event type"
  echo ""
  echo -e "  ${BOLD}Useful commands:${NC}"
  echo -e "    ${YELLOW}$COMPOSE_CMD logs -f${NC}          — View live logs"
  echo -e "    ${YELLOW}$COMPOSE_CMD ps${NC}               — Check service status"
  echo -e "    ${YELLOW}$COMPOSE_CMD down${NC}             — Stop all services"
  echo -e "    ${YELLOW}$COMPOSE_CMD up -d${NC}            — Start all services"
  echo -e "    ${YELLOW}./deploy.sh --update${NC}          — Pull latest and restart"
  echo ""
  echo -e "  ${BOLD}Documentation:${NC}  ${CYAN}https://github.com/calcom/cal.diy${NC}"
  echo ""
}

# ============================================================================
# Update
# ============================================================================

update() {
  log_step "Updating Cal.diy..."

  if [[ -d .git ]]; then
    log_info "Pulling latest code..."
    git pull --ff-only 2>/dev/null || {
      log_warn "Git pull failed — you may have local changes. Continuing with Docker update."
    }
  fi

  log_info "Pulling latest Docker images..."
  $COMPOSE_CMD pull 2>/dev/null || true

  log_info "Rebuilding and restarting..."
  $COMPOSE_CMD up -d --build --remove-orphans

  log_info "Running database migrations..."
  sleep 10
  $COMPOSE_CMD exec -T calcom npx prisma migrate deploy 2>&1 || true

  log_success "Update complete!"
}

# ============================================================================
# Status
# ============================================================================

status() {
  log_step "Cal.diy Status"
  $COMPOSE_CMD ps
  echo ""

  local webapp_url
  webapp_url=$(grep "NEXT_PUBLIC_WEBAPP_URL=" .env 2>/dev/null | head -1 | cut -d"'" -f2 || echo "http://localhost:3000")

  if curl -sf "${webapp_url}/api/auth/providers" &>/dev/null 2>&1; then
    log_success "Web app is responding at ${webapp_url}"
  else
    log_warn "Web app is not responding at ${webapp_url}"
  fi
}

# ============================================================================
# Destroy
# ============================================================================

destroy() {
  log_warn "This will stop all services and DELETE ALL DATA."
  read -rp "  Are you sure? Type 'yes' to confirm: " confirm
  if [[ "$confirm" != "yes" ]]; then
    log_info "Cancelled."
    exit 0
  fi

  log_step "Destroying Cal.diy deployment..."
  $COMPOSE_CMD down -v --remove-orphans
  log_success "All services stopped and data removed."
}

# ============================================================================
# Main
# ============================================================================

main() {
  banner

  cd "$SCRIPT_DIR"

  case "${1:-}" in
    --update|-u)
      preflight
      update
      ;;
    --status|-s)
      COMPOSE_CMD="docker compose"
      docker compose version &>/dev/null 2>&1 || COMPOSE_CMD="docker-compose"
      status
      ;;
    --destroy)
      COMPOSE_CMD="docker compose"
      docker compose version &>/dev/null 2>&1 || COMPOSE_CMD="docker-compose"
      destroy
      ;;
    --help|-h)
      echo "Usage: ./deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  (none)           Deploy Cal.diy with auto-configuration"
      echo "  -i, --interactive  Deploy with interactive configuration wizard"
      echo "  -u, --update     Pull latest and restart"
      echo "  -s, --status     Check service status"
      echo "  --destroy        Stop everything and delete data"
      echo "  -h, --help       Show this help"
      ;;
    *)
      preflight
      configure "${1:-}"
      deploy
      print_success
      ;;
  esac
}

main "$@"
