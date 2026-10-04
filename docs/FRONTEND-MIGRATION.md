# Frontend audit: what's left after the backend port

Audited: `public.zip` (frontend `src/` + `public/`, 242 files, about 32,000 lines), against the new Express backend.

## Where things stand

The frontend is **partly migrated**. The new API layer exists and works against the new backend: `src/lib/apiClient.ts`
(axios, refresh-token cookie, auto-retry on 401) and `src/api/` (auth, profiles, rooms, messages, friends, calls, mentions,
moderation, wallet, uploads), plus a socket client. Chat, rooms, friends, calls, profiles and login/signup already go through it.

**65 of the files still talk to Supabase directly**, so everything below the chat core is still pointed at the old project:

| Supabase feature | Where it's still used |
|---|---|
| Direct table queries (`supabase.from`) | 42 tables, 173 call sites in 65 files |
| RPC functions | 34 named + 6 chosen at runtime (`add_post_comment`, `add_page_post_comment`, `forward_post_to_room`, `forward_page_post_to_room`, `approve_verification`, `reject_verification`) |
| Edge functions | 17 calls in 8 files: `send-push` (5), `create-payment` (2), `verify-payment` (2), `process-withdrawal` (2), `admin-broadcast` (2), `admin-delete-user`, `resolve-account`, `rotate-push-subscription` |
| Realtime channels | 14 in 10 files |
| Storage uploads | 10 calls in 5 files (buckets `chat-media`, `avatars`, `statuses`, `ad-banners`); the app already has a `/uploads` API for this |
| `supabase.auth.getUser()` | 15 places (only used to get the user id; `useAuth().user.id` already has it) |
| Service worker | `public/sw.js` hard-codes the Supabase URL and anon key |

Until these move, those screens keep hitting the old Supabase project: they won't see anything created on the new backend and nothing they do reaches it.

## Things that are wrong today (not just unfinished)

1. **Signup never redeems the referral code.** `SignupPage` saves `?ref=` in localStorage, then ignores it (the code comment says so).
   `signup` in `src/api/auth.ts` has no `referralCode` field. Backend is ready: send `referralCode`.
2. **Contact matching won't find most people.** The app hashes the contact's digits exactly as saved
   (`+234 802…` becomes `234802…`, `0802…` stays `0802…`). Your profiles store numbers as `0802…` (25 of 35) or without the leading 0 (10 of 35).
   Only contacts saved in the same form match. This is why none of your exported contact hashes matched a profile. Fix belongs on the **backend**
   (match every common form of a stored number). See B7.
3. **Coins credited from the browser.** `DailyActivityPage` calls `credit_reward_coins` (+100 "sponsor boost") and `AdminPage` calls
   `refund_earned_coins` straight from the client. Those functions don't exist on the new backend (deliberately: anyone could have called them for any amount),
   so both flows will fail. They need server endpoints (B2).
4. **Calls won't ring a closed app.** `CallContext` calls the `send-push` edge function for incoming and cancelled calls. `send-push` is no longer public
   (it was an open relay), so the server must send those pushes itself (B3).
5. **Push re-subscription is broken after cutover.** `sw.js` and `usePushSubscription.ts` post to the Supabase `rotate-push-subscription` function with the Supabase anon key.
6. **Report actions return 400.** The UI sets report status `actioned`; the backend only accepted `resolved` and `dismissed` (B6).
7. **Admin-granted Premium would be undone within 10 minutes.** `UsersSection` toggles `profiles.is_premium` directly, but the new background job sets that flag from real subscriptions (my step 8).
   This one is a regression I introduced; it needs a proper grant endpoint (B5).
8. **Old payment calls would be refused.** `TreasuresPage` and `VerificationPage` send `userId` and (for coins) get credited from client-supplied data; the new `/api/payments/*` ignores prices from the client and checks ownership.
   `PremiumPage` already uses the new call but still sends an `amount` (ignored).

## Backend gaps found (small, needed by the frontend) — **all done, see API-changes.md Step 10**

| # | Gap | Needed by |
|---|---|---|
| B1 | `app_settings` read/update (10 settings: signups, maintenance, min age, upload limits, profanity filter, auto-suspend at N reports, ...). No SQL function ever read them, so this is plain read/write; nothing enforces them yet | `SettingsSection` |
| B2 | Daily claim: `GET` status (claims today, next claim time), the response shape the page expects (`claims_today`, `next_claim_at`), and a safe "sponsor boost" endpoint (max 2 x 100 coins per claim, checked server-side) | `DailyActivityPage` |
| B3 | Server-sent call pushes (`incoming_call` on `call:invite`, `call_cancelled` when a call ends/is declined/missed) | `CallContext` |
| B4 | Admin push: to all devices, and to one user | `BroadcastSection`, `UsersSection` |
| B5 | Admin grant/revoke Premium (as a real subscription row) and Verified, with audit log | `UsersSection`, `AdminPage` |
| B6 | Accept report status `actioned` (keep `resolved`, `dismissed`) | `ReportsSection`, `ReportedMediaSection`, `AdminPage` |
| B7 | Contact matching across number formats (+234 / 0 / bare 10 digits) | `InviteContactsPage` |
| B8 | Message reactions: list and remove (only add exists), view count for your own message | `MessageReactions`, `ChatMessage` |
| B9 | Admin: list/delete rooms, delete any message, subscriptions list, per-recipient email delivery log | `ChatsSection`, `ReportsSection`, `ReportedMediaSection`, `RevenueSection`, `DeliveryStatusSection` |
| B10 | Socket events that Supabase Realtime used to provide (see F8) | 14 channels |

## Progress (code is in this zip: drop `src/` over your project, then delete the files in `DELETE-THESE-FILES.txt`)
- [x] Admin retirement: `/admin` redirects to `/super-admin`, `AdminPage.tsx` removed, Pages and Most Active Users sections added
- [x] F1 Foundation (signup referral code, forgot-password phone, payment call types)
- [x] F2 Push, calls, service worker
- [x] F3 Wallet and payments (Treasures, gifts, level-up, withdrawals, Verification, Daily claim + boost, Analytics)
- [x] F4 Feed and pages (17 files)
- [x] F5 Statuses
- [ ] F6 to F9 (in progress, one package per step)

## Work packages (suggested order)

B1 to B10 are done on the backend. Do the frontend in this order. Each package is independent after F1.

### F1. Foundation (about 1 day)
- `signup` sends `referralCode` (read `4go-referral-code` from localStorage, clear it after).
- Replace all 15 `supabase.auth.getUser()` with `useAuth().user`.
- Optional: `forgotPassword(email, phone?)` if you turn on `REQUIRE_PHONE_FOR_RESET`.
- `initiatePayment` type: drop `coinAmount`; `amount` only matters for coins.
- Keep `integrations/supabase/types.ts` until the end (the API modules import `Tables<...>` types from it); then regenerate types from the Prisma schema or hand-write them.

### F2. Push, calls, service worker
- `sw.js`: remove `SUPABASE_URL` and `SUPABASE_ANON_KEY`; rotate with `POST {API}/api/push/rotate` (body `oldEndpoint, endpoint, p256dh, auth`, no auth header). The worker has no env access, so inject the API URL at build time or hard-code it.
- `usePushSubscription.ts`: use `GET /api/push/vapid-public-key` (or keep the same key), `POST /api/push/subscribe`, `POST /api/push/unsubscribe` on logout; replace both `rotate-push-subscription` uses (one is a raw `fetch` with the anon key).
- `CallContext.tsx`: delete the three `send-push` invocations once B3 is done.
- Delete `hooks/useCall.ts`: nothing imports it and it still uses Supabase Realtime.

### F3. Wallet and payments
- `TreasuresPage`: `initiatePayment({ purpose: "coins", amount })` then `verifyPayment(id)`; gifts via `POST /api/wallet/gifts`, treasures via `GET /api/wallet/treasures`.
- `VerificationPage`: new payment API (`purpose: "verification"`, no amount); it now answers 403/409 before payment if you aren't eligible; show that message.
- `PremiumPage`: stop sending `amount`; use `GET /api/payments/prices` for display.
- `DailyActivityPage`: new daily-claim endpoints (B2).
- `GiftPostDialog`: `POST /api/wallet/gifts/post`. `RanksPage` / level up: `POST /api/wallet/level-up`.
- `AnalyticsPage`: earnings per day from `GET /api/wallet/transactions`.
- Withdrawals: bank-account lookup via `POST /api/payouts/resolve-account`.

### F4. Feed and pages (largest user-facing area)
Replace table reads/writes with `/api/feed/*` and `/api/pages/*` (every endpoint is in `API-changes.md`). Response shapes differ:
feed posts come back as `{ ...post, profile, is_liked }` (nested `profile`), page-feed rows are flat (`page_name`, `page_avatar`).
Comments: `/api/feed/:id/comments` and `/api/pages/posts/:id/comments`. Sharing: `.../forward`. Likes, saves, views, boosts: toggle endpoints.

### F5. Statuses
`StatusPage` and `HomeStatusStrip` to `/api/statuses/*`; uploads via `/api/uploads` (folder `statuses`) instead of the `statuses` bucket. The type value for pictures is `photo`.

### F6. Chat, social, profile
`NotificationBell` (announcements, mentions, employee alerts), `MessageReactions`, `ChatMessage` (view recording and count), `SupportLiveChat` + `SupportPage`,
`InviteContactsPage`, `ReferralPage`, `ContestsPage`, `GettingStartedChecklist`, `GlobalCallOverlay`, `ProfileBadges`, `UserProfilePreview`, `MentionTextarea` and the rest in the list below.

### F7. Admin (24 files, the biggest single piece)
Every `SuperAdminPage` section moves to `/api/admin/*`, `/api/contests`, `/api/ads`, `/api/broadcast`, `/api/employees`, `/api/verification/admin`, `/api/support`.
`AdminPage.tsx` (route `/admin`) looks like an older duplicate of `SuperAdminPage` (`/super-admin`): contests, withdrawals, reports, users, rooms, pages are all in both.
**Decided: `/admin` is retired, `/super-admin` stays** (see `retire-admin/README.md`; the two things only `/admin` had, Pages and Activity, are added to `/super-admin` there). That drops one of the 24 admin files (850 lines of direct database writes, including the client-side coin refund). Also: the admin screens must now handle 403 by role (moderator, support, employee see less).

### F8. Realtime
The 14 Supabase Realtime channels become socket events or refetches:

| Channel (file) | Replace with |
|---|---|
| `notif-bell`: global announcements, mentions, employee notifications | socket `notification:new` (needs B10), `mention:new` (exists), `employee:notification` (exists) |
| `support-inbox`, `support-chat-*`, `support-msgs-*` | socket `support:message` (exists); conversation list refetch |
| `support-typing-*` (broadcast) | socket typing event (needs B10) |
| `reactions-<messageId>` | socket `reaction:new` (exists) and `reaction:removed` (B10) |
| `home-status-strip`, `status-page-feed`, `status-reactions-*` | refetch on focus / short interval, or `status:changed` (B10) |
| `profile-flags-*`, `profile-preview-*` (verified/premium/rank live) | refetch when opened; optional `profile:updated` (B10) |
| `admin-audit` | refetch every 30 s or on open (admin only) |
| `call-<roomId>` (broadcast) | dead code (`useCall.ts`), delete |

### F9. Clean-up and test
Delete `integrations/supabase/client.ts`, remove `@supabase/supabase-js` and the `VITE_SUPABASE_*` variables, then run `tsc`. Test the checklist in `API-changes.md` end to end: signup with referral,
buy coins, buy premium, post and comment on a page, gift, withdraw, a call to a closed app, suspend a user as a moderator.

## Appendix: every remaining Supabase call, by file

### F2 Push, calls and service worker (3 files)

| File | What it still calls on Supabase |
|---|---|
| `contexts/CallContext.tsx` | edge fn: send-push |
| `hooks/useCall.ts` | realtime x1 |
| `hooks/usePushSubscription.ts` | edge fn: rotate-push-subscription |

### F3 Wallet and payments (5 files)

| File | What it still calls on Supabase |
|---|---|
| `components/GiftPostDialog.tsx` | tables: treasures (select); rpc: send_gift_to_post |
| `pages/AnalyticsPage.tsx` | tables: transactions (select) |
| `pages/DailyActivityPage.tsx` | tables: daily_claims (select); rpc: claim_daily_reward, credit_reward_coins |
| `pages/TreasuresPage.tsx` | tables: treasures (select), profiles (select); rpc: request_withdrawal, send_gift, spend_coins_for_progress; edge fn: create-payment, resolve-account, verify-payment |
| `pages/VerificationPage.tsx` | edge fn: create-payment, verify-payment |

### F4 Feed and pages (17 files)

| File | What it still calls on Supabase |
|---|---|
| `components/feed/CommentSheet.tsx` | tables: post_comments (delete/select), profiles (select), page_posts (select/update), posts (select/update); rpc: edit_post_comment, add_page_post_comment, add_post_comment |
| `components/feed/CreatePostCard.tsx` | tables: posts (insert); storage: chat-media |
| `components/feed/FeedSection.tsx` | tables: posts (select), profiles (select), page_posts (select), pages (select), post_likes (select); rpc: get_feed_posts, get_page_feed |
| `components/feed/PostCard.tsx` | tables: posts (delete/update); rpc: toggle_post_like |
| `components/feed/SharePostDialog.tsx` | tables: friends (select), profiles (select), room_members (select), rooms (select); rpc: get_or_create_dm_room, forward_page_post_to_room, forward_post_to_room |
| `components/feed/SharedPagePostMessage.tsx` | tables: page_posts (select), pages (select) |
| `components/feed/SharedPostMessage.tsx` | tables: posts (select), profiles (select) |
| `components/pages/BoostModal.tsx` | tables: profiles (select); rpc: boost_page_post |
| `components/pages/PagePostCard.tsx` | tables: post_saves (delete/insert); rpc: record_page_post_view, toggle_page_post_like |
| `components/pages/PagePostComposer.tsx` | tables: page_posts (insert); storage: chat-media |
| `pages/CreatePagePage.tsx` | rpc: create_page; storage: avatars |
| `pages/DiscoverPage.tsx` | tables: pages (select) |
| `pages/PageDashboardPage.tsx` | tables: pages (select), page_posts (select), post_boosts (select) |
| `pages/PagePostViewPage.tsx` | tables: page_posts (select), pages (select), post_likes (select), post_saves (select) |
| `pages/PageProfilePage.tsx` | tables: pages (select), page_followers (select), profiles (select), page_posts (select), post_saves (select); rpc: follow_page, unfollow_page |
| `pages/PagesListPage.tsx` | tables: pages (select), page_followers (select) |
| `pages/SavedLibraryPage.tsx` | tables: post_saves (select), page_posts (select), pages (select) |

### F5 Statuses (2 files)

| File | What it still calls on Supabase |
|---|---|
| `components/HomeStatusStrip.tsx` | tables: statuses (select), profiles (select); realtime x1 |
| `pages/StatusPage.tsx` | tables: statuses (delete/insert/select), profiles (select), status_views (insert/select), status_reactions (delete/select/upsert), messages (insert); rpc: get_or_create_dm_room; realtime x2; storage: statuses |

### F6 Chat, social and profile (14 files)

| File | What it still calls on Supabase |
|---|---|
| `components/ChatMessage.tsx` | tables: message_views (select); rpc: record_message_view |
| `components/GlobalCallOverlay.tsx` | tables: friends (select), profiles (select) |
| `components/MessageReactions.tsx` | tables: message_reactions (delete/insert/select); realtime x1 |
| `components/NotificationBell.tsx` | tables: global_notifications (select), notification_reads (insert/select), mentions (select), employee_notifications (select); realtime x1 |
| `components/ProfileBadges.tsx` | tables: profiles (select); realtime x1 |
| `components/UserProfilePreview.tsx` | tables: profiles (select); realtime x1 |
| `components/ads/AdSlot.tsx` | tables: ad_banners (select); rpc: track_ad_event |
| `components/onboarding/GettingStartedChecklist.tsx` | tables: friends (select), posts (select) |
| `components/support/SupportLiveChat.tsx` | tables: support_conversations (insert/select/update), support_messages (insert/select); realtime x2 |
| `pages/ContestsPage.tsx` | tables: contests (select), contest_participants (insert/select); rpc: get_contest_leaderboard |
| `pages/InviteContactsPage.tsx` | tables: device_contacts (delete/insert), friends (insert/select); rpc: find_contact_matches |
| `pages/LeaderboardPage.tsx` | tables: profiles (select) |
| `pages/ReferralPage.tsx` | tables: profiles (select), referrals (select) |
| `pages/SupportPage.tsx` | tables: profiles (select); rpc: get_or_create_dm_room |

### F7 Admin (24 files)

| File | What it still calls on Supabase |
|---|---|
| `components/superadmin/sections/ActiveUsersSection.tsx` | auth.getUser x2 |
| `components/superadmin/sections/AdBannersSection.tsx` | tables: ad_banners (delete/insert/select/update), advertisers (select); storage: ad-banners |
| `components/superadmin/sections/AdminsSection.tsx` | auth.getUser x1 |
| `components/superadmin/sections/AdvertisersSection.tsx` | tables: advertisers (delete/insert/select/update) |
| `components/superadmin/sections/AuditLogSection.tsx` | tables: admin_audit_logs (select); realtime x1 |
| `components/superadmin/sections/BroadcastSection.tsx` | tables: push_subscriptions (select), global_notifications (insert), broadcast_deliveries (insert); edge fn: admin-broadcast, send-push |
| `components/superadmin/sections/ChatsSection.tsx` | tables: rooms (delete) |
| `components/superadmin/sections/ContestsAdminSection.tsx` | tables: contests (delete/insert/select/update) |
| `components/superadmin/sections/DeliveryStatusSection.tsx` | tables: email_send_log (select), broadcast_deliveries (select); rpc: admin_email_campaign_stats |
| `components/superadmin/sections/EmployeeActivityLogSection.tsx` | auth.getUser x1 |
| `components/superadmin/sections/EmployeeDashboardSection.tsx` | auth.getUser x2 |
| `components/superadmin/sections/EmployeesAdminSection.tsx` | auth.getUser x1 |
| `components/superadmin/sections/PaymentsSection.tsx` | tables: withdrawals (select); rpc: admin_complete_withdrawal, admin_reject_withdrawal; edge fn: process-withdrawal |
| `components/superadmin/sections/ReportedMediaSection.tsx` | tables: moderation_reports (update), messages (delete), profiles (update); auth.getUser x1 |
| `components/superadmin/sections/ReportsSection.tsx` | tables: moderation_reports (update), profiles (update), messages (delete) |
| `components/superadmin/sections/SecuritySection.tsx` | tables: profiles (update), push_subscriptions (delete); auth.getUser x1 |
| `components/superadmin/sections/SettingsSection.tsx` | tables: app_settings (select/update); auth.getUser x1 |
| `components/superadmin/sections/SupportInboxSection.tsx` | tables: support_conversations (select/update), profiles (select), support_messages (insert/select); realtime x3; auth.getUser x1 |
| `components/superadmin/sections/UsersSection.tsx` | tables: profiles (update); edge fn: admin-delete-user, send-push; auth.getUser x2 |
| `components/superadmin/sections/VerificationSection.tsx` | tables: verification_applications (select), profiles (select); rpc: approve_verification, reject_verification |
| `components/superadmin/useAdminData.ts` | tables: profiles (select), moderation_reports (select), subscriptions (select), rooms (select); rpc: admin_platform_stats; auth.getUser x1 |
| `components/superadmin/useAnalyticsData.ts` | rpc: admin_daily_metrics, admin_message_type_breakdown; auth.getUser x1 |
| `pages/AdminPage.tsx` | tables: verification_applications (select), profiles (select/update), global_notifications (insert), moderation_reports (select/update), withdrawals (select/update), rooms (delete/select), contests (delete/insert/select/update), pages (delete/select), contest_participants (select); rpc: admin_get_chat_activity, admin_suspend_user, admin_unsuspend_user, is_super_admin, refund_earned_coins, reward_contest_participant; edge fn: process-withdrawal |
| `pages/SuperAdminPage.tsx` | rpc: get_admin_role |

### Other files (no Supabase calls)
`AuthContext`, `CallContext` (socket part), `api/*`, `lib/apiClient`, `lib/tokenStore`, `sockets/SocketContext` are already on the new backend.
