#!/usr/bin/env bash
set -euo pipefail

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
${CYAN}Manel — Uninstall Script${NC}

Removes Manel (Security Health Monitor) from your system.

${BOLD}Usage:${NC}
  $(basename "$0") [options]

${BOLD}Options:${NC}
  --help      Show this help message
  --all       Also remove installation directory and config files
  --yes       Skip confirmation prompts

${BOLD}What it does:${NC}
  1. Removes global npm link for 'manel'
  2. Optionally removes the installation directory
  3. Confirms uninstallation
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
REMOVE_ALL=false
SKIP_CONFIRM=false

for arg in "$@"; do
  case "$arg" in
    --help) show_help ;;
    --all)  REMOVE_ALL=true ;;
    --yes)  SKIP_CONFIRM=true ;;
    *)
      error "Unknown option: $arg"
      echo "Run $(basename "$0") --help for usage."
      exit 1
      ;;
  esac
done

# ─── Find manel installation ────────────────────────────────────────────────
step "Locating Manel installation"

MANEL_PATH=""
if command -v manel &>/dev/null; then
  MANEL_PATH="$(which manel)"
  ok "Found global link: $MANEL_PATH"
else
  info "No global 'manel' command found."
fi

# Check for common installation directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT=""

# Check if we're inside the manel repo
if [ -f "$SCRIPT_DIR/package.json" ] && grep -q '"name": "manel"' "$SCRIPT_DIR/package.json" 2>/dev/null; then
  REPO_ROOT="$SCRIPT_DIR"
elif [ -d "$HOME/manel" ] && [ -f "$HOME/manel/package.json" ]; then
  REPO_ROOT="$HOME/manel"
fi

if [ -n "$REPO_ROOT" ]; then
  ok "Found repository: $REPO_ROOT"
else
  warn "Could not locate repository directory."
fi

# ─── Confirm ─────────────────────────────────────────────────────────────────
if [ "$SKIP_CONFIRM" = false ]; then
  echo ""
  echo -e "${YELLOW}The following will be removed:${NC}"
  if [ -n "$MANEL_PATH" ]; then
    echo -e "  • Global link: ${CYAN}$MANEL_PATH${NC}"
  fi
  if [ "$REMOVE_ALL" = true ] && [ -n "$REPO_ROOT" ]; then
    echo -e "  • Repository: ${CYAN}$REPO_ROOT${NC}"
  fi
  echo ""
  read -r -p "$(echo -e "${YELLOW}Proceed with uninstall? [y/N]${NC} ")" REPLY
  case "$(echo "$REPLY" | tr '[:upper:]' '[:lower:]')" in
    y|yes) ;;
    *)
      info "Uninstall cancelled."
      exit 0
      ;;
  esac
fi

# ─── Remove global link ─────────────────────────────────────────────────────
step "Removing global link"

if command -v manel &>/dev/null; then
  info "Running npm unlink -g manel..."
  npm unlink -g manel 2>/dev/null || npm uninstall -g manel 2>/dev/null || true

  # Verify removal
  if command -v manel &>/dev/null; then
    warn "Global link may still exist. You may need to remove it manually:"
    echo "    rm -f $(which manel)"
  else
    ok "Global link removed"
  fi
else
  info "No global link to remove"
fi

# ─── Remove repository (optional) ──────────────────────────────────────────
if [ "$REMOVE_ALL" = true ] && [ -n "$REPO_ROOT" ]; then
  step "Removing repository"

  info "Removing $REPO_ROOT..."
  rm -rf "$REPO_ROOT"
  ok "Repository removed"
fi

# ─── Verify ──────────────────────────────────────────────────────────────────
step "Verifying uninstallation"

if command -v manel &>/dev/null; then
  warn "Manel command still available at: $(which manel)"
  echo "  You may need to restart your shell or remove the link manually."
else
  ok "Manel has been removed from PATH"
fi

# ─── Finish ──────────────────────────────────────────────────────────────────
step "Done"

echo -e "${GREEN}${BOLD}  ✅ Manel uninstalled successfully!${NC}"
echo ""
echo -e "  ${BOLD}Notes:${NC}"
echo -e "    • Run ${CYAN}hash -r${NC} to refresh your shell's command cache"
echo -e "    • If installed via npm globally, you can also run:"
echo -e "      ${CYAN}npm uninstall -g manel${NC}"
echo ""
