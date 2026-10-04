# Frontend merge notes

Merged from three sources: the original `public.zip`, the parallel migration snapshots (`frontend__4_`), and the
chat/social/profile migration. Where both sides rewrote a file, the parallel version was kept (it pairs with its
`api/feed.ts`, `api/pages.ts`, `api/statuses.ts`); my additions were layered on top.

Off Supabase now: auth/signup, chat, calls, push + service worker, wallet, payments, daily claim, feed, pages,
statuses, notifications, profile, referrals, contacts, leaderboard, support chat, contests, ads.

Still on Supabase (admin only, 23 files, ~93 calls): everything under `components/superadmin/` plus
`pages/SuperAdminPage.tsx` (`get_admin_role`). Keep `integrations/supabase/client.ts` and `@supabase/supabase-js`
until those move.

`docs/FRONTEND-MIGRATION.md` is the older audit; its checklist is partly out of date. `docs/API-changes.md` is still
the endpoint reference.
