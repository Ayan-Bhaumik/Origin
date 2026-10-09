<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Brand icon links belong in the TanStack root document head, and share-image metadata belongs in leaf route heads; this app has no index.html.
- Public clip actions (send, retrieve, delete, report, code checks) run only in server functions in `src/lib/clips.functions.ts` using the admin client; the clips table has no public access policies, so PINs, burn-after-read and rate limits can't be bypassed.
- Admin pages run client-only under `src/routes/admin.tsx` and read/write through the browser client, protected by admin-role RLS policies; every admin mutation calls `logAudit`.
- Clip expiry is enforced at read time plus `expire_clips()` (hourly cron + opportunistic sweeps on requests); stored files are removed via the `storage_purge` queue because SQL cannot delete storage blobs.
- Shared clip rules (code format, timers, PIN format, limits) live in `src/lib/clip-rules.ts` and are tested there.
