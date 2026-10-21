#!/usr/bin/env bash
# Copies the shared extension files into firefox/ (keeping its own manifest) and builds both ZIPs.
set -euo pipefail
cd "$(dirname "$0")"
FILES="qrcode.js shared.js background.js content.js popup.html popup.js styles.css icons"
for f in $FILES; do rm -rf "firefox/$f"; cp -r "$f" "firefox/$f"; done
mkdir -p dist
rm -f dist/origin-chrome.zip dist/origin-firefox.zip
zip -qr dist/origin-chrome.zip manifest.json $FILES
(cd firefox && zip -qr ../dist/origin-firefox.zip manifest.json $FILES)
echo "Built dist/origin-chrome.zip and dist/origin-firefox.zip"
