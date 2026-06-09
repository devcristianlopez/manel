#!/usr/bin/env bash
set -e

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Help ────────────────────────────────────────────────────────────────────
show_help() {
  cat <<EOF
${CYAN}Manel — Setup Script${NC}

Installs Manel (Security Health Monitor) globally on your system.

${BOLD}Usage:${NC}
  $(basename "$0") [options]

${BOLD}Options:${NC}
  --help     Show this help message
  --dev      Install devDependencies (test/lint tooling)

${BOLD}What it does:${NC}
  1. Detects OS (Linux / macOS / Windows)
  2. Checks/installs Node.js 18+
  3. Clones the repo if not present
  4. Runs npm install
  5. Compiles with npm run build
  6. Rebuilds native Electron modules
  7. Installs globally via npm link
  8. Verifies installation (manel version, manel status)

${BOLD}Requirements:${NC}
  - Git
  - curl, wget, or a package manager (for Node.js install)

${BOLD}Supported:${NC}
  Linux, macOS  —  Windows (manual instructions only)
EOF
  exit 0
}

# ─── Log helpers ─────────────────────────────────────────────────────────────
info()  { echo -e "${CYAN}  •${NC} $1"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $1"; }
error() { echo -e "${RED}  ✗${NC} $1"; }
step()  { echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━${NC}"; }

# ─── Flags ───────────────────────────────────────────────────────────────────
DEV_MODE=false

for arg in "$@"; do
  case "$arg" in
    --help) show_help ;;
    --dev)  DEV_MODE=true ;;
    *)
      error "Unknown option: $arg"
      echo "Run $(basename "$0") --help for usage."
      exit 1
      ;;
  esac
done

# ─── OS Detection ────────────────────────────────────────────────────────────
step "Detecting operating system"

OS="$(uname -s)"
case "$OS" in
  Linux*)  OS_NAME="linux"   ;;
  Darwin*) OS_NAME="darwin"  ;;
  CYGWIN*|MINGW*|MSYS*)      OS_NAME="windows" ;;
  *)
    error "Unsupported OS: $OS"
    exit 1
    ;;
esac
ok "Detected: ${OS_NAME^}"

if [ "$OS_NAME" = "windows" ]; then
  step "Windows support"
  warn "Windows is not yet supported by this script."
  echo ""
  echo "  To install Manel on Windows manually:"
  echo "    1. Install Node.js 18+ from https://nodejs.org"
  echo "    2. Open PowerShell as Administrator and run:"
  echo "       git clone https://github.com/devcristianlopez/manel.git"
  echo "       cd manel"
  echo "       npm install"
  echo "       npm run build"
  echo "       npx @electron/rebuild"
  echo "       npm link"
  echo "       manel version"
  echo ""
  exit 1
fi

# ─── Node.js check ───────────────────────────────────────────────────────────
step "Checking Node.js"

install_node() {
  warn "Node.js 18+ not found, attempting automatic install..."

  if command -v nvm &>/dev/null || [ -f "$HOME/.nvm/nvm.sh" ]; then
    info "Using nvm..."
    [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
    nvm install 18
    nvm use 18
    ok "Node.js installed via nvm"
    return 0
  fi

  case "$OS_NAME" in
    linux)
      if command -v apt-get &>/dev/null; then
        info "Installing via apt..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ok "Node.js installed via apt"
        return 0
      fi
      if command -v dnf &>/dev/null; then
        info "Installing via dnf..."
        sudo dnf install -y nodejs
        ok "Node.js installed via dnf"
        return 0
      fi
      if command -v pacman &>/dev/null; then
        info "Installing via pacman..."
        sudo pacman -S --noconfirm nodejs npm
        ok "Node.js installed via pacman"
        return 0
      fi
      ;;
    darwin)
      if command -v brew &>/dev/null; then
        info "Installing via Homebrew..."
        brew install node@18
        brew link --overwrite node@18
        ok "Node.js installed via Homebrew"
        return 0
      fi
      ;;
  esac

  error "Could not install Node.js automatically."
  echo ""
  echo "  Please install Node.js 18+ manually:"
  echo "    - https://nodejs.org/"
  echo "  Or using nvm:"
  echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "    nvm install 18"
  echo ""
  echo "  Then re-run this script."
  exit 1
}

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 18 ] 2>/dev/null; then
    ok "Node.js $(node -v) detected"
  else
    warn "Node.js $(node -v) is too old (18+ required)"
    install_node
  fi
else
  install_node
fi

# ─── Git check ───────────────────────────────────────────────────────────────
step "Checking Git"

if ! command -v git &>/dev/null; then
  error "Git is not installed. Please install Git and re-run."
  exit 1
fi
ok "Git $(git --version | head -c 15) detected"

# ─── Repo ────────────────────────────────────────────────────────────────────
step "Repository"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"

if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/package.json" ]; then
  ok "Already inside Manel repository: $REPO_ROOT"
  cd "$REPO_ROOT"
elif [ -d "$SCRIPT_DIR/manel" ] && [ -f "$SCRIPT_DIR/manel/package.json" ]; then
  ok "Found existing clone in $SCRIPT_DIR/manel"
  cd "$SCRIPT_DIR/manel"
elif [ -d "$HOME/manel" ] && [ -f "$HOME/manel/package.json" ]; then
  ok "Found existing clone in $HOME/manel"
  cd "$HOME/manel"
else
  info "Cloning repository..."
  git clone https://github.com/devcristianlopez/manel.git "$HOME/manel"
  ok "Repository cloned to $HOME/manel"
  cd "$HOME/manel"
fi

# ─── Already installed? ──────────────────────────────────────────────────────
step "Checking previous installation"

if command -v manel &>/dev/null; then
  echo ""
  warn "Manel is already installed globally ($(which manel))."
  read -r -p "$(echo -e "${YELLOW}  Reinstall? [y/N]${NC} ")" REPLY
  case "$(echo "$REPLY" | tr '[:upper:]' '[:lower:]')" in
    y|yes) info "Reinstalling..." ;;
    *)
      info "Skipping."
      exit 0
      ;;
  esac
fi

# ─── Install dependencies ────────────────────────────────────────────────────
step "Installing dependencies"

if [ "$DEV_MODE" = true ]; then
  info "Dev mode: installing all dependencies (including devDependencies)..."
  npm install
else
  info "Installing production dependencies..."
  npm install --omit=dev
fi
ok "Dependencies installed"

# ─── Build ───────────────────────────────────────────────────────────────────
step "Compiling project"

info "Running npm run build..."
npm run build
ok "Build complete"

# ─── Rebuild native modules ──────────────────────────────────────────────────
step "Rebuilding native Electron modules"

info "Running @electron/rebuild..."
npx @electron/rebuild
ok "Native modules rebuilt"

# ─── Global install ──────────────────────────────────────────────────────────
step "Installing globally"

info "Running npm link..."
npm link
ok "Manel linked globally"

# ─── Verify ──────────────────────────────────────────────────────────────────
step "Verifying installation"

info "Checking 'manel version'..."
if ! manel version 2>/dev/null; then
  warn "'manel version' did not produce output, but the binary was linked."
fi

info "Checking 'manel status'..."
manel status 2>/dev/null || warn "'manel status' returned non-zero (expected if first run)"

# ─── Finish ──────────────────────────────────────────────────────────────────
step "Done"

echo -e "${GREEN}${BOLD}  ✅ Manel instalado globalmente!${NC}"
echo ""
echo -e "  ${BOLD}Comandos disponibles:${NC}"
echo -e "    ${CYAN}manel status${NC}     → Estado rápido del entorno"
echo -e "    ${CYAN}manel scan${NC}       → Escaneo completo"
echo -e "    ${CYAN}manel run${NC}        → Abrir dashboard Electron"
echo -e "    ${CYAN}manel hardening${NC}  → Checks de seguridad del SO"
echo -e "    ${CYAN}manel help${NC}       → Ayuda"
echo ""
echo -e "  ${BOLD}Primer paso:${NC} ${CYAN}manel status${NC}"
echo ""
