
<div align="center">
   
### Created by

# Ayan Bhaumik
**AI/ML Engineer · Full-Stack Developer**

[![Portfolio](https://img.shields.io/badge/Portfolio-ayanbhaumik.in-6366F1?style=for-the-badge)](https://ayanbhaumik.in/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-ayan--bhaumik-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/ayan-bhaumik/)
[![GitHub](https://img.shields.io/badge/GitHub-Ayan--Bhaumik-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ayan-Bhaumik)
[![Google Scholar](https://img.shields.io/badge/Scholar-Publications-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white)](https://scholar.google.com/citations?user=ArGuUjgAAAAJ&hl=en)
[![Email](https://img.shields.io/badge/Email-connect@mrayanbhaumik.in-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:connect@mrayanbhaumik.in)

---

# origin.

### **Move anything between your devices, instantly.**

Text, code, images, and files — no accounts, no logins, no friction. Just a short code.

[![Live App](https://img.shields.io/badge/Live_App-origin.ayanbhaumik.in-6366F1?style=flat-square&logoColor=white)](https://origin.ayanbhaumik.in/)
[![Version](https://img.shields.io/badge/Version-v1.1.0-818CF8?style=flat-square)](https://github.com/Ayan-Bhaumik/Origin/releases/tag/v1.1.0)
[![React](https://img.shields.io/badge/React_19-TanStack_Start-000000?style=flat-square&logo=react&logoColor=61DAFB)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## ⚡ What is origin?

Most clipboards only work within an ecosystem (Apple AirDrop, Windows Clipboard, Google sync). **origin** provides a frictionless, universal bridge across all operating systems and devices (iOS, Android, macOS, Windows, Linux) without requiring app installs, logins, or user tracking. 

Paste or drop your content, get an unambiguous 6-character code (or scan an instant QR code), and pick it up on any device in seconds. Everything is temporary and auto-purges after expiration.

---

## 🚀 Key Features

### 📤 Sending Clips
- **Multi-Attachment Bundles** — Send up to **20 images** (10 MB each) and up to **20 files** (25 MB each) in a single clip, up to 100 MB total. One short code unlocks the whole bundle!
- **Text & Code Clips** — Up to 100 KB text with automatic markdown detection and syntax highlighting.
- **Paste & Drop Anywhere** — Paste screenshots or drag files directly onto the browser window.
- **Unambiguous Codes** — Auto-generated 6-character codes with confusing look-alike characters removed (`0`, `O`, `1`, `I`, `L`).
- **Custom Codes** — Pick memorable custom codes (4–20 characters: letters, numbers, hyphens) with live availability verification.
- **PIN Lockout** — Optional 4–8 digit PIN with brute-force rate-limiting (locks for 15 minutes after 5 failed attempts).
- **Burn-After-Read** — Instant permanent deletion immediately following first retrieval.
- **Granular Expiry Timers** — `10 min` · `30 min` · `1 hr (Default)` · `2 hr` · `3 hr` · `6 hr` · `12 hr` · `24 hr max`.
- **Read Receipts** — Optional one-time webhook trigger notified the moment the clip is opened.
- **Instant QR Code** — Displayed alongside copyable codes for quick camera scanning from mobile devices.

### 📥 Retrieving Clips
- **Instant Deep Links** — Direct navigation via `origin.ayanbhaumik.in/r/:code`.
- **One-Click ZIP Download** — Multi-file and multi-image bundles can be packaged and downloaded instantly as a single `.zip` archive on the fly in the browser.
- **Markdown Studio** — View text with a **Raw / Preview** toggle, rendered tables, task lists, and syntax-highlighted code blocks.
- **Security Challenges** — Clean PIN prompt, remaining-attempt counters, and lock timers.
- **Abuse Reporting** — Built-in flag-and-review modal to report prohibited content directly to the moderation queue.

---

## 🧩 Browser Extensions (Chrome & Firefox)

Send text selections, images, links, or whole tabs directly to origin with a single right-click or through the quick popup.

<div align="center">

[![Download Chrome Extension](https://img.shields.io/badge/Download-Chrome%20%2F%20Chromium%20v1.1-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/Ayan-Bhaumik/Origin/releases/download/v1.1.0/origin-chrome_v1.1.zip)
[![Download Firefox Add-on](https://img.shields.io/badge/Download-Firefox%20v1.1-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://github.com/Ayan-Bhaumik/Origin/releases/download/v1.1.0/origin-firefox_v1.1.zip)

</div>

### ✨ Extension Highlights:
- **Right-Click Context Menu**:
  - Right-click text selection → **"Send to origin"**
  - Right-click image → **"Send image to origin"**
  - Right-click hyperlink → **"Send link to origin"**
  - Right-click page background → **"Send this page to origin"**
- **Popup Workflow**:
  - **"Use this page's link"** — 1-click grab of current tab title and URL.
  - **Multi-File Attachments** — Drag and drop or attach up to 20 files directly from the popup.
  - **Instant QR Code Generator** — Generate mobile-scannable QR codes immediately after sending.
  - **Retrieve Tab** — Fetch text, images, or download files right inside the extension window.
  - **Recent History** — Quick access and 1-click link copying for your last 5 sent codes.

#### Installation:
* **Chrome / Brave / Edge / Chromium**: Download `origin-chrome_v1.1.zip` → Extract → Go to `chrome://extensions/` → Enable **Developer Mode** → Click **Load Unpacked** → Select the extracted folder.
* **Firefox**: Download `origin-firefox_v1.1.zip` → Go to `about:debugging#/runtime/this-firefox` → Click **Load Temporary Add-on** → Select any file in the unzipped folder.

---

## 📱 Progressive Web App (PWA) & Shortcuts

- **Installable App** — Add origin to your home screen on iOS and Android for a native app feel.
- **Offline Shell** — Built with service-worker caching for instant cold starts even on unstable networks.
- **Local History** — Your last 5 sent clips are remembered locally in the browser with live countdown timers.
- **Keyboard Shortcuts**:

| Key Combination | Action |
|---|---|
| `⌘ / Ctrl + Enter` | Send current clip |
| `/` | Instantly focus the retrieval input |
| `Escape` | Clear form, dismiss results, or close modals |

---

## 🛡️ Admin Suite (`/admin`)

- **Telemetry Dashboard** — Real-time metrics, 30-day activity graphs, and content type breakdowns.
- **Clip Management** — Search, inspect metadata, extend TTL, force-expire, or bulk-delete.
- **Abuse Queue** — Review flagged clips with one-click resolution or permanent purging.
- **Dynamic Controls** — Live toggle for maintenance mode, banner announcements, timer ceilings, and blocked code lists.
- **Full Audit Log** — Immutable audit trail of every moderator action with CSV export.

---

## 🛠️ Architecture & Tech Stack

```text
[ Browser / PWA / Extension ]
             │
             ▼
  [ TanStack Start v1 (React 19) + Vite 7 ]
             │
             ├── Client State & Caching: TanStack Query
             ├── Styling & Design System: Tailwind CSS v4
             ├── In-Browser Compression: JSZip
             │
             ▼
  [ Server Functions & REST API (/api/public/*) ]
             │
             ▼
  [ Supabase Cloud Infrastructure ]
     ├── Database: PostgreSQL with Row-Level Security (RLS)
     ├── File Storage: Private encrypted buckets with signed access URLs
     └── Automation: Scheduled purge queues & cron expiration sweeps
```

| Layer | Technology |
|---|---|
| **Framework** | [TanStack Start v1](https://tanstack.com/start) (Full-Stack React 19 + SSR) |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS v4 + Semantic Design Tokens |
| **Archive Engine** | JSZip (Client-Side In-Memory ZIP Assembly) |
| **Backend & Auth** | Supabase (PostgreSQL, Storage, Auth, Edge Functions) |
| **Browser Extension** | Manifest V3 (Vanilla JS, Context Menus, Scripting API) |
| **Hosting & DNS** | Cloudflare Edge & Hostinger DNS |

---

## 🔒 Security & Privacy Model

- **Zero User Identification**: No tracking cookies, accounts, email requirements, or fingerprinting.
- **CSPRNG Code Generation**: Cryptographically secure pseudo-random 6-character tokens excluding visually ambiguous characters.
- **Argon2-Grade PIN Hashing**: PINs and delete tokens are hashed at rest and evaluated using constant-time comparisons.
- **Signed Storage Access**: All file downloads use time-limited (60-second) cryptographic signatures.
- **Automatic Purging**: Expired content and associated storage blobs are systematically scrubbed through scheduled worker sweeps.

---

## 🗺️ Roadmap

- [x] Ephemeral text, code, image, and file clips
- [x] Custom alphanumeric codes with real-time availability check
- [x] PIN challenge protection & rate-limited lockouts
- [x] Burn-after-read self-destruction
- [x] PWA support with offline caching shell
- [x] Markdown preview with syntax highlighting
- [x] Webhook read receipts
- [x] Admin operations console & abuse review queue
- [x] Multi-attachment bundles (up to 20 images and 20 files per clip)
- [x] Client-side "Download All (.zip)" packaging
- [x] Manifest V3 Browser Extension v1.1 (Chrome & Firefox) with QR codes and page/link sharing
- [ ] End-to-End Encryption (AES-256-GCM in URL hash fragment)
- [ ] Terminal CLI client (`origin-cli`)
- [ ] WebRTC peer-to-peer room mode for direct device-to-device transfers

---

<div align="center">

Made with care by [Ayan Bhaumik](https://ayanbhaumik.in/)

</div>
