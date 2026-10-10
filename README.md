<div align="center">

### Created by

# Ayan Bhaumik

AI/ML Engineer · Full-Stack Developer

[![Portfolio](https://img.shields.io/badge/Portfolio-ayanbhaumik.in-6366F1?style=flat-square)](https://ayanbhaumik.in/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-ayan--bhaumik-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/ayan-bhaumik/)
[![GitHub](https://img.shields.io/badge/GitHub-Ayan--Bhaumik-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/Ayan-Bhaumik)
[![Scholar](https://img.shields.io/badge/Google%20Scholar-Publications-4285F4?style=flat-square&logo=googlescholar&logoColor=white)](https://scholar.google.com/citations?user=ArGuUjgAAAAJ&hl=en)
[![Email](https://img.shields.io/badge/Email-connect@mrayanbhaumik.in-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:connect@mrayanbhaumik.in)

---

# origin.

**Move anything between your devices, instantly.**

Text, images and files — no account, no app. Just a short code.

[![Live](https://img.shields.io/badge/Live-origin.app-6366F1?style=flat-square&logoColor=white)](https://origin.app)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Cloudflare](https://img.shields.io/badge/Hosted%20on-Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://cloudflare.com)
[![Domain from Hostinger](https://img.shields.io/badge/Domain-Hostinger-673DE6?style=flat-square)](https://www.hostinger.com/)

</div>

---

## What is origin?

**origin** is a lightweight, anonymous cross-device clipboard. Most clipboards only work on one device. origin gives you a secure, temporary channel to move text, images, and files between any devices — no account, no app, no friction.

---

## Features

### Sending Clips
- **Three content types** — Text (100 KB), Images (10 MB), Files (25 MB)
- **Paste & drop anywhere** — paste screenshots or drag files directly onto the dropzone
- **Auto-generated codes** — clean 6-character codes, no confusing characters (`0`, `O`, `1`, `I`, `L`)
- **Custom codes** — 4–20 characters with live availability check and reserved word blocking
- **PIN protection** — optional 4–8 digit PIN, locked for 15 min after 5 wrong attempts
- **Burn after read** — content wiped immediately on first view
- **Flexible expiry** — 10 min · 30 min · 1 hr (default) · 2 hr · 3 hr · 6 hr · 12 hr · 24 hr max
- **Read receipts** — optional webhook ping when your clip is viewed
- **Success screen** — large code display, copy link, QR code, live countdown, delete-now button

### Retrieving Clips
- **Deep links** — `/r/:code` opens and fetches instantly
- **PIN challenge** — clean prompt if protected
- **Instant actions** — copy text, copy/download images, download files
- **Abuse reporting** — built-in report modal for recipients
- **Clear status messages** — expired, burned, locked, rate-limited — all handled gracefully

### PWA
- Installable on iOS and Android as a standalone app
- Offline shell — loads without internet, graceful messaging for live actions

### Recent History
- Last 5 sent clips saved locally in your browser
- Live countdown per clip, copy link, auto-removes on expiry

### Markdown Preview
- Auto-detects markdown in text clips
- Raw / Preview toggle with syntax-highlighted code blocks
- Powered by react-markdown + remark-gfm + rehype-highlight

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `⌘ / Ctrl + Enter` | Send clip |
| `Escape` | Clear form / close modal |
| `/` | Focus retrieve input |

### Admin Panel `/admin`
- **Dashboard** — 30-day activity chart, clip type distribution, key stats
- **Clips manager** — searchable, filterable table with full detail drawer; view, extend, force-expire, delete, bulk delete
- **Reports queue** — review flagged clips, dismiss or delete
- **Live settings** — timers, size limits, MIME allowlist, blocked codes, maintenance mode, announcement banner
- **Security** — IP block list, rate-limit activity log
- **Audit log** — every admin action logged, CSV export

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| Data fetching | TanStack Query |
| Backend | Supabase (Database + Storage + Auth + Edge Functions) |
| Hosting | Cloudflare Pages |
| Domain | Hostinger |


---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- npm or bun

### Local Development

```bash
git clone https://github.com/Ayan-Bhaumik/origin
cd origin
npm install
npm run dev
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_api_key        # optional, for admin email alerts
```

### Supabase Setup

1. Create a new Supabase project
2. Run the migrations from `/supabase/migrations/` in the Supabase SQL editor
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy expire-clips
   supabase functions deploy cleanup-metadata
   ```
4. Set the cron schedules in Supabase Dashboard:
   - `expire-clips` → `* * * * *` (every minute)
   - `cleanup-metadata` → `0 * * * *` (every hour)
5. Create your admin account in the Supabase Auth dashboard
6. Enable Row Level Security — all policies are included in the migrations

### Build for Production

```bash
npm run build
```

---

## How It Works

```
01 Add your content      02 Get your code         03 Retrieve anywhere
─────────────────────    ─────────────────────    ─────────────────────
Paste text, drop an      A short code is          Enter the code on any
image, or upload         generated. Share it      device to get your
any file.                or scan the QR.          content.
```

---

## Security

- Codes generated with CSPRNG, excluding look-alike characters
- PINs stored as argon2 hashes, never returned to the client
- Delete tokens hashed in the database
- Signed, short-lived (60s) URLs for file downloads
- Files stored under random IDs, never user-supplied paths
- Constant-time PIN comparison to resist timing attacks
- Rate limiting on send, retrieve, and availability-check endpoints
- Content erased at expiry — only metadata retained for 7 days
- Admin session protected with CSRF, httpOnly cookies, idle timeout

---

## Privacy

Content is temporary and auto-deleted. The site owner can access stored content via the admin panel. Do not share sensitive or personal information.

---

## Roadmap

- [x] Text, image, and file clips
- [x] Custom codes + PIN protection
- [x] Burn after read
- [x] PWA + offline support
- [x] Markdown preview + syntax highlighting
- [x] Read receipts
- [x] Admin dashboard
- [ ] Multi-file upload (zip)
- [ ] Public API with API keys
- [ ] Send code by email / SMS
- [ ] Browser extension

---

<div align="center">

Built with [Supabase](https://supabase.com) · Hosted on [Cloudflare](https://cloudflare.com) · Domain via [Hostinger](https://hostinger.com)

</div>
