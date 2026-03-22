#!/usr/bin/env bash
set -euo pipefail

# Build script for xterm-mobile
# Patches a stock ttyd index.html with the custom tmux overlay, mobile optimizations,
# and WebSocket intercept.
#
# Usage:
#   ./build.sh                          # uses dist/index.html as base (pre-built)
#   ./build.sh /path/to/ttyd-index.html # patch a fresh ttyd build

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
DIST_DIR="$SCRIPT_DIR/dist"

BASE_HTML="${1:-$DIST_DIR/index.html}"

if [ ! -f "$BASE_HTML" ]; then
  echo "Error: Base HTML not found: $BASE_HTML"
  echo "Usage: $0 [path/to/ttyd-index.html]"
  exit 1
fi

OUTPUT="$DIST_DIR/index.html"
mkdir -p "$DIST_DIR"

echo "Building xterm-mobile..."
echo "  Base: $BASE_HTML"

python3 << PYEOF
import re

with open('$SRC_DIR/ws-intercept.js') as f:
    ws_intercept = f.read().strip()
with open('$SRC_DIR/overlay.css') as f:
    overlay_css = f.read().strip()
with open('$SRC_DIR/overlay.html') as f:
    overlay_html = f.read().strip()
with open('$SRC_DIR/overlay.js') as f:
    overlay_js = f.read().strip()

with open('$BASE_HTML') as f:
    html = f.read()

# Check if already patched (has tmux-overlay)
if 'tmux-overlay' in html:
    print("  Base already contains tmux-overlay — rebuilding from source files")
    # Remove existing patches: second <style>, overlay HTML, and last <script>
    # Find the closing </body></html>
    body_end = html.rfind('</body>')
    if body_end == -1:
        body_end = len(html)

    # Remove existing custom overlay (everything from the second </style> block to </body>)
    # Strategy: find last </script></body> and work backwards to find our injected content
    # Simpler: just find and remove the known custom blocks
    html = re.sub(r'<style>\s*html,body\{overflow.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<div id="tmux-overlay">.*?</div>\s*</div>\s*<div id="tmux-prompt-overlay">.*?</div>\s*</div>', '', html, flags=re.DOTALL)
    # Remove last script block (our overlay.js) - it starts with (function(){ and gesture handlers
    html = re.sub(r'<script>\s*\(function\(\)\{\s*//.*?Prevent page zoom.*?</script>', '', html, flags=re.DOTALL)

# Inject WS intercept in <head> if not already present
if '__ttydWS' not in html:
    html = html.replace('</head>', '<script>' + ws_intercept + '</script>\n</head>', 1)

# Inject custom CSS before </body>
# Inject overlay HTML before </body>
# Inject overlay JS before </body>
body_close = html.rfind('</body>')
if body_close == -1:
    body_close = html.rfind('</html>')
if body_close == -1:
    body_close = len(html)

injection = (
    '<style>\n' + overlay_css + '\n</style>\n'
    + overlay_html + '\n'
    + '<script>\n' + overlay_js + '\n</script>\n'
)

html = html[:body_close] + injection + html[body_close:]

with open('$OUTPUT', 'w') as f:
    f.write(html)

print(f"  Output: $OUTPUT ({len(html):,} bytes)")
PYEOF

echo "Done."
