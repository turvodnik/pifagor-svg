#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$HOME/.local/bin"
SERVICES_DIR="$HOME/Library/Services"
WORKFLOW_NAME="Optimize with Pifagor SVG.workflow"

cd "$ROOT_DIR"
swift build -c release --product pifagor-svg-cli

mkdir -p "$BIN_DIR"
cp "$ROOT_DIR/.build/release/pifagor-svg-cli" "$BIN_DIR/pifagor-svg-cli"
chmod +x "$BIN_DIR/pifagor-svg-cli"

mkdir -p "$SERVICES_DIR"
rm -rf "$SERVICES_DIR/$WORKFLOW_NAME"
cp -R "$ROOT_DIR/QuickActions/$WORKFLOW_NAME" "$SERVICES_DIR/$WORKFLOW_NAME"

/System/Library/CoreServices/pbs -flush || true

echo "Quick Action installed:"
echo "$SERVICES_DIR/$WORKFLOW_NAME"
echo ""
echo "Finder: right click SVG/folder -> Quick Actions -> Optimize with Pifagor SVG"
