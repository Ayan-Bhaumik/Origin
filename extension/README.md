# origin browser extension

Send selected text or any image to origin with a right-click, or use the toolbar popup to send and retrieve clips. Works in Chrome (and other Chromium browsers) and Firefox.

## Features
- Right-click selected text → **Send to origin** → code is copied and shown in a toast.
- Right-click an image → **Send to origin** → the image is uploaded, code copied and shown.
- Popup **Send** tab: text box, timer chips (10 min – 24 hr, default 1 hr), recent history (last 5).
- Popup **Retrieve** tab: enter a code (and PIN if asked) to view text, preview images or download files.
- Stores only your recent codes in `storage.local`. No tracking; talks only to `https://origin.ayanbhaumik.in/api/public/*` (plus the image you right-click, to upload it).

## API used
- `POST https://origin.ayanbhaumik.in/api/public/clips` — JSON `{ content, type, timer, pin, burnAfterRead, customCode }` or multipart with `file`. Returns `{ code, expiresAt, deleteToken }`.
- `GET https://origin.ayanbhaumik.in/api/public/clips/:code[?pin=1234]` — returns `{ code, type, content, fileUrl, fileName, expiresAt, burned, pinProtected }`.
- Errors: `{ error, code }` with a matching HTTP status.

## Load in Chrome
1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `extension/` folder (or unzip `dist/origin-chrome.zip` and pick that folder).
3. Pin the origin icon from the puzzle-piece menu.

## Load in Firefox
1. Run `./build.sh` once so `firefox/` has all files (already done in this repo).
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
3. Select `firefox/manifest.json`. (Temporary add-ons are removed when Firefox restarts.)

## Publish to the Chrome Web Store
1. Run `./build.sh` to create `dist/origin-chrome.zip`.
2. Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time US$5 fee).
3. **New item** → upload the ZIP. Add description, 128×128 icon, at least one 1280×800 screenshot, and a privacy policy URL.
4. In **Privacy practices**, explain each permission: contextMenus (right-click item), storage (recent codes), activeTab + scripting (show the toast on the current page), host permission (talk to origin).
5. Submit for review (usually a few days).

## Publish to Firefox Add-ons
1. Run `./build.sh` to create `dist/origin-firefox.zip`.
2. Sign in at [addons.mozilla.org Developer Hub](https://addons.mozilla.org/developers/) → **Submit a New Add-on**.
3. Choose **On this site** (listed) or **On your own** (self-distributed, signed file), upload the ZIP.
4. If asked for source code, say none is needed — the files are plain, unminified JavaScript.
5. Fill in listing details and submit. The add-on ID is `origin@ayanbhaumik.in`.

## Updating
Bump `version` in both `manifest.json` files, run `./build.sh`, and upload the new ZIPs.
