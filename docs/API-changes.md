# Frontend changes needed (steps 1–9c)

I don't have your frontend code, so this is the list of calls to wire up. Everything needs the normal
`Authorization: Bearer` header unless marked "public". Errors are `{ "error": "message" }` with a 4xx status.

## Step 2: coins (base `/api/wallet`)
| Old Supabase call          | New endpoint                  | Body                                                 | Response |
|----------------------------|-------------------------------|------------------------------------------------------|----------|
| `send_gift`                | `POST /gifts`                 | `{ receiver_id, treasure_id, room_id? }`             | 201 `{ gift_id, price }` |
| `send_gift_to_post`        | `POST /gifts/post`            | `{ receiver_id, treasure_id, message_id, room_id? }` | 201 `{ gift_id, price }` |
| `spend_coins_for_progress` | `POST /level-up`              | `{ amount? }` (default 10000, multiples of 5000)     | `{ new_rank, total_minutes, coins_spent, minutes_added, coins_remaining }` |
| treasures select           | `GET /treasures`              | none                                                 | `[{ id, name, price, ... }]` |

`sender_id` is no longer sent; the server uses the logged-in user. Gifting yourself now returns 400.
`POST /api/profiles/me/presence` now also updates rank, monetized and verified: refetch the profile after it.

## Step 3: feed (base `/api/feed`)
| Old Supabase call            | New endpoint                          | Notes |
|------------------------------|---------------------------------------|-------|
| `get_feed_posts`             | `GET /?limit=20&offset=0`             | Ranked for signed-in users. Each post: `{...post, profile, is_liked, feed_score}`. Guests, or `?before=<iso>`, get newest-first. Blocked users' posts are hidden. |
| `toggle_post_like`           | `POST /:postId/like`                  | `{ liked }` |
| `add_post_comment`           | `POST /:postId/comments`              | `{ content, parent_id? }` → 201 comment |
| `edit_post_comment`          | `PATCH /:postId/comments/:commentId`  | `{ content }` |
| delete own comment (table)   | `DELETE /:postId/comments/:commentId` | Also deletes replies; `{ deleted: n }` |
| post_saves insert/delete     | `POST /:postId/save`                  | toggle → `{ saved }` |
| post_saves select            | `GET /saved`                          | saved posts, newest save first |
| update own post (table)      | `PATCH /:postId`                      | `{ content?, image_url? }` |
| `forward_post_to_room`       | `POST /:postId/forward`               | `{ room_id, note? }` → 201 message (`type: "shared_post"`, content is JSON `{ post_id, note }`) |

## Step 3: pages (base `/api/pages`, new)
| Old Supabase call / table op | New endpoint                               | Notes |
|------------------------------|--------------------------------------------|-------|
| pages select (public)        | `GET /?q=&owner=me&limit=&offset=`         | each page has `is_followed` when signed in |
| pages I follow               | `GET /following`                           | |
| `create_page`                | `POST /`                                   | `{ name, about?, category?, profile_image?, cover_image? }` → 201. 403 messages for rank too low / page limit. King can now create pages |
| page detail (public)         | `GET /:pageId`                             | page + `owner` + `is_followed` |
| update / delete page         | `PATCH /:pageId`, `DELETE /:pageId`        | owner or super admin |
| `follow_page`                | `POST /:pageId/follow`                     | `{ following: true }` |
| `unfollow_page`              | `DELETE /:pageId/follow`                   | `{ following: false }` |
| page posts select (public)   | `GET /:pageId/posts?before=&limit=`        | each post has `page`, `is_liked`, `is_saved` |
| create page post             | `POST /:pageId/posts`                      | `{ content?, media_url?, media_type: text\|image\|video }`, owner only |
| `get_page_feed`              | `GET /feed?limit=20&offset=0`              | flat rows: `page_name`, `page_avatar`, `is_followed`, `is_boosted`, `is_saved`, `is_liked`, `score` |
| update / delete page post    | `PATCH /posts/:postId`, `DELETE /posts/:postId` | owner or super admin |
| `toggle_page_post_like`      | `POST /posts/:postId/like`                 | `{ liked }` |
| `add_page_post_comment`      | `POST /posts/:postId/comments`             | `{ content, parent_id? }`; list with `GET /posts/:postId/comments`; edit/delete same paths as feed |
| save / unsave page post      | `POST /posts/:postId/save`, `GET /posts/saved` | toggle → `{ saved }` |
| `record_page_post_view`      | `POST /posts/:postId/view`                 | `{ recorded, unique_views }`, `{ self_view }` or `{ already_viewed }` |
| `boost_page_post`            | `POST /posts/:postId/boost`                | `{ plan: tier_2k\|tier_4k\|tier_10k\|tier_20k }` → 201; purchased coins only. Plans: `GET /boost-plans` |
| `forward_page_post_to_room`  | `POST /posts/:postId/forward`              | `{ room_id, note? }` → 201 message (`type: "shared_page_post"`, content `{ page_post_id, note }`) |

## Step 3: messages (base `/api/messages`)
- `record_message_view` → `POST /:messageId/view` → `{ recorded, view_count }`, `{ already_viewed, view_count }` or `{ self_view }`. Caller must be in the room.
- `POST /room/:roomId` (send) now returns 403 for suspended accounts, blocked DMs, and non-staff posting in the "📢 4GO Announcements" room.

## Step 4: wallet extras (base `/api/wallet`)
- `GET /gifts?direction=sent|received|all` → gifts you sent or received, newest first, each with `direction`, `sender`, `receiver`, `treasure`.

## Step 4: referrals
- **Signup:** `POST /api/auth/signup` accepts an optional `referralCode`. A valid code pays the referrer 500 reward coins. Codes are case-insensitive; an unknown code never blocks signup. There is no client-callable `process_referral` any more.
- `GET /api/referrals/me` → `{ code, bonus_per_referral, total, referrals: [{ id, created_at, coins_rewarded, referred }] }`
- `GET /api/referrals/referred-by` → `{ created_at, referrer }` or `null`

## Step 4: contests (base `/api/contests`, all signed-in)
| Old Supabase call / table op | New endpoint | Notes |
|------------------------------|--------------|-------|
| contests select              | `GET /?status=` | each has `participant_count`, `joined`, `rewarded` |
| one contest                  | `GET /:contestId` | same fields |
| `get_contest_leaderboard`    | `GET /:contestId/leaderboard` | `[{ user_id, display_name, username, avatar_url, rank, joined_at, online_minutes_since_join, score, criteria, rewarded, rewarded_at }]` |
| participants insert          | `POST /:contestId/join` | 201 `{ joined: true }` (200 if already in). 400 unless the contest is `active` and inside its start/end window |
| create / update / delete     | `POST /`, `PATCH /:contestId`, `DELETE /:contestId` | super admin only. Body: `title, description?, reward_amount, status: draft\|active\|ended, starts_at?, ends_at?, max_winners?, criteria: online_minutes\|messages_sent\|referrals\|coins_earned, criteria_label?` (dates are ISO strings) |
| `reward_contest_participant` | `POST /:contestId/participants/:userId/reward` | super admin only; 409 if already rewarded |

## Step 4: statuses (base `/api/statuses`, all signed-in)
| Old Supabase call / table op | New endpoint | Notes |
|------------------------------|--------------|-------|
| statuses select              | `GET /` | your + friends' unexpired statuses, newest first; each has `profile`, `has_viewed`, `my_reaction`; yours also `view_count`, `reaction_count`. Group per user on the client |
| create status                | `POST /` | `{ type: text\|photo\|video, media_url?, caption?, bg_color?, text_content? }`; text needs `text_content`, photo/video need `media_url`. Expires after 24h |
| delete own status            | `DELETE /:statusId` | 204 |
| status_views insert          | `POST /:statusId/view` | `{ recorded }` or `{ self_view }` |
| who viewed (author)          | `GET /:statusId/viewers` | `[{ viewer, viewed_at, emoji }]`, author only |
| status_reactions upsert      | `PUT /:statusId/reaction` | `{ emoji }`; one reaction per user, replaces the previous |
| remove reaction              | `DELETE /:statusId/reaction` | 204 |

## Step 5: verification (base `/api/verification`, all signed-in)
| Old Supabase call / table op        | New endpoint                              | Notes |
|-------------------------------------|-------------------------------------------|-------|
| `submit_verification_application`   | (unchanged) `POST /api/payments/verify` with purpose `verification` | created after the ₦ payment succeeds |
| view own applications               | `GET /me`                                 | newest first |
| admin: list applications            | `GET /admin/applications?status=pending&limit=&offset=` | super admin; each row has `profile` |
| `approve_verification`              | `POST /admin/:applicationId/approve`      | `{ notes? }` → `{ approved: true }`; 409 if not pending |
| `reject_verification`               | `POST /admin/:applicationId/reject`       | `{ notes? }` → `{ rejected: true, refunded_coins }` (₦1 = 2 reward coins) |

## Step 5: support chat (base `/api/support`, all signed-in)
| Old Supabase call / table op | New endpoint | Notes |
|------------------------------|--------------|-------|
| conversations select         | `GET /conversations` | your own. Support staff: `?view=agent&status=&assigned=me&limit=&offset=` for everyone's (each has `user`) |
| create conversation          | `POST /conversations` | `{ subject?, message }` → 201 `{ conversation, message }` (first message is created with it) |
| one conversation             | `GET /conversations/:id` | agents also get `user` |
| support_messages select      | `GET /conversations/:id/messages` | oldest first |
| support_messages insert      | `POST /conversations/:id/messages` | `{ content }` → 201. **Don't send `is_agent`**: the server decides. A customer replying to a closed/resolved chat reopens it |
| reset unread badge           | `POST /conversations/:id/read` | 204; clears your side's unread count |
| `set_support_status`         | `PATCH /conversations/:id/status` | `{ status: open\|escalated\|closed\|resolved }`, support staff only |

Live event (socket): `support:message` → `{ conversationId, messageId, preview, fromUserId? }`, sent to the customer when an agent replies, and to every support agent when a customer writes.

## Step 5: contacts (base `/api/contacts`, all signed-in)
- `PUT /` `{ contacts: [{ phone_hash, name? }] }` (max 2000; `phone_hash` = SHA-256 hex of the number with digits only, computed on the device) → `{ received, added }`
- `GET /matches?limit=50` (ports `find_contact_matches`) → `[{ user_id, display_name, username, avatar_url, contact_name, is_friend, has_pending_request }]`
- `DELETE /` → 204, forgets your uploaded contacts

## Step 5: mentions (base `/api/mentions`)
- `GET /search?q=jo&room_id=<uuid>&limit=8` (ports `search_mentionable_users`) → `[{ user_id, username, display_name, avatar_url, priority }]` (1 = in this room, 2 = friend, 3 = anyone)
- `POST /` (record mentions) now silently skips anyone who blocked you or whom you blocked.

## Step 6: push notifications (base `/api/push`)
| Old Supabase call / table op        | New endpoint | Notes |
|-------------------------------------|--------------|-------|
| VAPID public key (was an env var in the client) | `GET /vapid-public-key` | public, `{ publicKey }` |
| `push_subscriptions` insert/upsert  | `POST /subscribe` | signed-in. Body: `subscription.toJSON()` (`{ endpoint, keys: { p256dh, auth } }`) or flat `{ endpoint, p256dh, auth }`. 201 `{ ok: true }`. If another account used this browser before, the device moves to the current user |
| `push_subscriptions` delete         | `POST /unsubscribe` | signed-in, `{ endpoint }` → 204. Call on sign-out |
| `rotate-push-subscription` edge fn  | `POST /rotate` | **no login needed** (service-worker `pushsubscriptionchange`). Body `{ oldEndpoint?, endpoint, p256dh, auth }` → `{ ok: true }` or `{ ok: false, reason: "no_mapping" }`. Update the URL in your service worker |

- `send-push` is **not** exposed any more (it was callable by anyone with the anon key). The server sends pushes itself.
- Only real browser push services are accepted as `endpoint` (Chrome/FCM, Firefox, Edge/Windows, Safari); anything else gets a 400.
- Notifications are sent automatically for: new room messages (everyone but the sender), @mentions, and new support messages (to support staff). The payload is `{ title, body, data: { navigateTo, tag } }` as before.
- One change: shared posts now show "🔗 Shared a post" as the notification body instead of raw JSON.

## Step 7: broadcasts and notifications

### Admin (base `/api/broadcast`, super admin only). Replaces the `admin-broadcast` edge function
| Old `admin-broadcast` mode | New endpoint | Body / response |
|----------------------------|--------------|-----------------|
| announce                   | `POST /announce` | `{ title, message, priority?: low\|normal\|high\|urgent }` → `{ ok, recipients }`. Adds a notification-centre entry, posts in the "📢 4GO Announcements" room (everyone is added) and pushes to all users |
| email                      | `POST /email` | `{ subject, message }` → `{ ok, recipients }` = emails queued (sent in the background, about 5/s). 409 if the exact same campaign was sent in the last 5 minutes |
| resend_dlq                 | `POST /email/resend-failed` | → `{ ok, requeued }` |
| stats (`admin_email_campaign_stats`) | `GET /email/stats?days=7` | → `{ since, waiting, stats: [{ status, count }] }` (status: sent, failed, dlq, rate_limited, suppressed; `waiting` = still queued) |
| broadcast history          | `GET /deliveries` | last 50 |

### Users (base `/api/notifications`, signed in)
- `GET /` → announcements, newest first, each with `is_read`
- `GET /unread-count` → `{ count }`
- `POST /read` → `{ notification_id? }` (omit to mark all read) → 204

### Unsubscribe (public, base `/api/email`)
- `GET /unsubscribe?token=…` shows a confirmation page; `POST /unsubscribe?token=…` unsubscribes (used by the page's button and by mail apps' one-click unsubscribe). Nothing for the frontend to build; emails link straight to the API.
- Auth emails (verification, password reset) are unchanged for the frontend: same `/verify-email?token=` and `/reset-password?token=` links. They now use the forego-branded template.

## Step 8: payments and withdrawals

### Payments (base `/api/payments`)
| Old call | New | Changes |
|----------|-----|---------|
| `create-payment` edge fn | `POST /initiate` `{ purpose: coins\|premium\|verification, amount?, plan?, redirectUrl? }` → `{ link, txRef }` | **coins:** `amount` (whole naira, = number of coins) is required. **premium:** send `plan` (`monthly`\|`yearly`); any `amount` is ignored. **verification:** no amount; 403/409 *before* payment if your rank is too low or an application is already open. `redirectUrl` must be on your own site or it's ignored. `coinAmount` is gone (₦1 = 1 coin) |
| `verify-payment` edge fn | `POST /verify` `{ transactionId }` | unchanged response. `transactionId` must be the numeric Flutterwave id. 403 "This payment belongs to another account" if it isn't yours. Safe to call again (returns success without crediting twice) |
| prices hard-coded in the client | `GET /prices` (public) | `{ currency, coins_per_naira, premium: { monthly, yearly }, verification }` |

`GET /api/wallet` now returns `is_premium` from the real subscription dates, so it turns false when a plan expires.

### Withdrawals (base `/api/payouts`, all signed-in)
| Old call | New | Notes |
|----------|-----|-------|
| `resolve-account` edge fn | `POST /resolve-account` `{ account_number (10 digits), account_bank }` → `{ success, account_name, account_number }` | now requires login; 20 lookups per hour per user |
| `process-withdrawal` edge fn | `POST /:withdrawalId/process` | **super admin only.** → `{ success, message, ref }`; on Flutterwave refusal 400 `{ success:false, refunded:true, error }`; on timeout 502 `{ refunded:false, error }` (left "processing") |
| `admin_complete_withdrawal` | `POST /:withdrawalId/complete` | moderators and super admins; marks it paid |
| (new) | `POST /:withdrawalId/fail` | super admin; fails a stuck "processing" withdrawal and refunds the user |

Withdrawal statuses the admin screen should handle: `pending`, `approved`, `processing`, `completed`, `failed`, `rejected`.
Approve/reject are still `PATCH /api/admin/withdrawals/:id` `{ decision }`.

## Step 9a: admin area (base `/api/admin`)

**Roles are now enforced per action.** Before, any staff row (moderator, support, employee) could do everything.
Roles: `super_admin`, `moderator`, `support`, `employee`. A 403 `{ error }` means the role isn't allowed.

| Action | New endpoint | Who |
|--------|--------------|-----|
| my role (`get_admin_role`) | `GET /me` → `{ role }` (`null` for normal users). `GET /api/profiles/me/admin-access` also returns `role` now | any signed-in user |
| find users | `GET /users?q=` | super admin: full profiles. moderator / support: id, name, username, avatar, rank, suspension info only |
| `admin_user_detail` | `GET /users/:userId/detail` | super admin |
| `admin_suspend_user` | `POST /users/:userId/suspend` `{ reason }` → 204 | moderator, super admin. Can't target yourself; only a super admin can target staff |
| `admin_unsuspend_user` | `POST /users/:userId/unsuspend` → 204 | moderator, super admin |
| `admin_set_monetized` | `POST /users/:userId/monetized` `{ value: boolean }` | super admin |
| `admin-delete-user` | `DELETE /users/:userId` → 204 | super admin. Refuses yourself and staff accounts (remove the admin role first) |
| reports | `GET /reports?status=`, `PATCH /reports/:id` `{ status: resolved\|dismissed }` | moderator, super admin |
| `admin_reported_messages` | `GET /reports/messages?types=image,video` | moderator, super admin |
| `admin_flagged_accounts` | `GET /flagged-accounts` | moderator, super admin |
| withdrawal review | `GET /withdrawals?status=pending`, `PATCH /withdrawals/:id` `{ decision: approve\|reject }` | moderator, super admin. **Approve now only works on `pending`** (409 otherwise). Paying out is `POST /api/payouts/:id/process` (super admin) |
| `admin_list_admins` | `GET /admins` | super admin |
| `admin_add_admin` | `POST /admins` `{ user_id, role }` (also changes an existing role) | super admin |
| `admin_remove_admin` | `DELETE /admins/:userId` → 204 | super admin |
| audit log | `GET /audit-logs?action=&actor=&before=&limit=` | super admin. Every action above is logged |
| `admin_devices` | `GET /devices` | super admin. Each device shows `endpoint_host` and `endpoint_tail` instead of the full push URL |
| `admin_security_overview` | `GET /security-overview` | super admin |

Suspending a user ends all their sessions immediately and sends them a live `account:suspended` event; they also can't refresh a session or log in again until unsuspended.

## Step 9b: stats, ads, rooms, suggestions

### Admin statistics (base `/api/admin/stats`)
| Old call | New endpoint | Who |
|----------|--------------|-----|
| `admin_platform_stats` | `GET /platform` → one object (`total_users`, `online_users`, …, `mrr`, `pending_withdrawals`) | moderator, super admin |
| `admin_daily_metrics` | `GET /daily?days=14` → `[{ day, new_users, messages, active_users, new_subs }]` oldest first | moderator, super admin |
| `admin_message_type_breakdown` | `GET /message-types` → `[{ type, count }]` | moderator, super admin |
| `admin_get_chat_activity` | `GET /chat-activity?days=7&limit=50` | moderator, super admin |
| `admin_active_users_windows` | `GET /active-windows` → `{ total_users, online_now, active_7, active_14, active_21, active_30 }` | super admin |
| `admin_active_users_list` | `GET /active-users?days=0` (0 = online now) | super admin |

### Ads (base `/api/ads`)
| Old call / table op | New endpoint | Notes |
|---------------------|--------------|-------|
| active banners select (public) | `GET /?placement=home&position=top` | → `[{ id, image_url, target_url, placements, position }]` |
| `track_ad_event` | `POST /:bannerId/events` `{ event: "impression" \| "click" }` → 204 | no login needed. The same address repeating the same event on the same banner within 30 s counts once |
| admin: banners | `GET/POST /admin/banners`, `PATCH/DELETE /admin/banners/:id` | moderator, super admin. Body: `{ advertiser_id?, image_url, target_url, placements: [home\|room\|menu\|feed\|profile\|dm], budget, status: active\|paused\|ended, position: top\|middle }`. URLs must be http(s) |
| admin: advertisers | `GET/POST /admin/advertisers`, `PATCH/DELETE /admin/advertisers/:id` | moderator, super admin. Deleting one keeps its banners |

### Rooms
- `get_room_member_counts` → `POST /api/rooms/member-counts` `{ room_ids: [...] }` → `[{ room_id, member_count }]`
- Join requests (`POST /api/rooms/:roomId/join-requests`, `PATCH /api/rooms/:roomId/join-requests/:requestId`):
  - requesting with a fee now charges the correct coin buckets; the same message "Not enough coins. You need N coins to request." on failure
  - **approving now pays the fee to the room creator** (it used to disappear); rejecting refunds it as reward coins
  - a request can be settled once: a second approve/reject returns 409 "Request not found or already processed"
  - someone who was approved but later left or was removed can request again (it used to say "You're already a member" forever)

### Friends
- `GET /api/friends/suggestions` (`get_people_you_may_know`): same shape, but now also suggests friends of your friends even if you share no room; people you've already sent, received or declined a request with are left out.

### Password reset
- `verify_reset_phone` is **not** a public call any more. Optionally turn on `REQUIRE_PHONE_FOR_RESET` on the server and send `{ email, phone }` to `POST /api/auth/forgot-password` (see `ENV-VARS.md`). The response is always the same generic 200.

## Step 9c: employees (sales team), base `/api/employees` (all signed-in)
An employee's team = people who signed up with their referral code (`/invited`) and the people those people invited (`/downline`).

| Old call | New endpoint | Who |
|----------|--------------|-----|
| `admin_list_employees` | `GET /admin/list` → `[{ user_id, display_name, username, avatar_url, phone_number, employee_since, total_invited, active_7, active_30 }]` | moderator, super admin |
| `admin_employee_activity_log` | `GET /admin/activity-log?employee=<id>&from=<iso>&to=<iso>&limit=500` | moderator, super admin |
| `employee_pipeline_stats` | `GET /:employeeId/pipeline` → `{ total_invited, active_7, active_14, active_21, active_30, online_now, downline }` | that employee, moderator, super admin |
| `employee_invited_users` | `GET /:employeeId/invited` (up to 1000) | same |
| `employee_downline` | `GET /:employeeId/downline` (up to 1000) | same |
| `log_employee_activity` | `POST /me/activity` `{ action, detail?, meta? }` → 204. **Don't send an employee id**: it's always you. Ignored unless you hold the employee role | signed-in |
| notifications table select (Realtime) | `GET /me/notifications`, `GET /me/notifications/unread-count` | signed-in |
| `mark_employee_notifications_read` | `POST /me/notifications/read` → 204 | signed-in |

## Realtime events (socket.io), replacing Supabase Realtime
| Event | When | Payload |
|-------|------|---------|
| `employee:notification` | someone an employee invited comes online (max one per person per 12 h) | `{ id, title, body, created_at }` |
| `support:message` | agent replied (to the customer) / customer wrote (to every support agent) | `{ conversationId, messageId, preview, fromUserId? }` |
| `account:suspended` | an admin suspended you | `{ reason }` |
| `message:new`, `message:notify`, `mention:new`, `presence:update` | unchanged | |

## Step 10: backend gaps from the frontend audit (B1 to B10)

### Admin (all under `/api/admin`)
| Need | Endpoint | Who |
|------|----------|-----|
| Grant / revoke Premium | `POST /users/:id/premium` `{ enabled, days? (default 30) }` → `{ is_premium }`. Creates / cancels a real `subscriptions` row (plan `admin_grant`), so the 10-minute premium sync keeps it | super admin |
| Grant / revoke Verified | `POST /users/:id/verified` `{ enabled }` → `{ is_verified }`. Can't remove it from a King | super admin |
| Push to one user | `POST /users/:id/notify` `{ title, body, url? }` → `{ sent, expired, total }` | moderator, super admin |
| Settings | `GET /settings?category=` → `[{ key, value, label, category }]`; `PUT /settings` `{ updates: [{ key, value }] }` (unknown keys → 404) | super admin |
| Rooms list | `GET /rooms?q=` → `[{ id, name, type, avatar_url, created_by, created_at, is_active, member_count, message_count }]` (DMs left out) | moderator, super admin |
| Delete room | `DELETE /rooms/:id` → 204. Removes messages, members, reads, pins, join requests, mutes, call logs | super admin |
| Delete any message | `DELETE /messages/:id` → 204 (for reported content) | moderator, super admin |
| Subscriptions | `GET /subscriptions?status=&since=<iso>&limit=` → rows with `display_name`, `username`, `avatar_url` | super admin |
| Report status | `PATCH /reports/:id` now accepts `resolved`, `dismissed` **or `actioned`** | moderator, super admin |
| Pages list | `GET /pages?q=` → `[{ id, name, category, followers_count, owner_id, created_at, profile_image, is_monetized }]` (delete with `DELETE /api/pages/:id`, super admin) | moderator, super admin |

Public: `GET /api/settings/public` → `{ signups_enabled, maintenance_mode, min_age, allow_media_uploads, allow_voice_notes, max_upload_mb, max_room_members }` (no sign-in needed). Settings are stored and editable, but **nothing enforces them yet**.

### Broadcast (`/api/broadcast`, super admin)
- `POST /push` `{ title, body, url? }` → `{ ok, recipients }` (push to every device; sent in the background; 409 on an identical push within 2 min). Shows up in `GET /deliveries`.
- `GET /email/log?since=<iso>&status=&q=&limit=` → per-email send log (default last 7 days).
- `GET /deliveries?since=<iso>` now accepts `since`.

### Daily activity (`/api/wallet`)
- `POST /daily-claim` → `{ coinsAwarded, coins_awarded, claimId }`.
- `GET /daily-claim/status` → adds snake_case twins: `can_claim`, `claims_today`, `max_per_day`, `next_claim_at`.
- `POST /daily-claim/boost` `{ stage: 1 | 2 }` → `{ alreadyGranted, coinsAwarded }`. +100 coins each; only on your latest claim, within 15 minutes, stage 2 only after stage 1, each once. **Replaces the client-side `credit_reward_coins` call** (which let anyone mint coins).

### Calls
- `call:invite` over the socket is verified against the call row (`POST /api/calls` first). Send `{ callId, roomId, calleeId, callType, sdp, group? }`; the caller's name and avatar are taken from the server, so don't send them.
- The server sends the `incoming_call` push on invite and the `call_cancelled` push when `PATCH /api/calls/:id` changes the status. **Delete the three `send-push` invocations in `CallContext.tsx`.**

### Contacts
- `PUT /api/contacts` accepts `replace: true` (the upload is your whole address book; contacts no longer on the phone are forgotten).
- `GET /api/contacts/matches?limit=&offset=` now matches a profile under `as stored`, last 10 digits, `0`+last 10 and `234`+last 10, so the device can keep hashing the digits as saved. Each person once.

### Messages
- `GET /api/messages/room/:roomId/reactions?ids=a,b,c` → reaction rows for up to 200 messages. `GET /api/messages/:id/reactions` for one.
- `DELETE /api/messages/:id/reactions/:emoji` removes your reaction (emits `reaction:removed`).
- `GET /api/messages/room/:roomId/views?ids=a,b,c` → `{ [messageId]: viewCount }` for **your** messages only.
- **Behaviour change:** `DELETE /api/messages/:id` is now the sender or a room admin only (any member could delete anything before), and it removes the message's reactions, views, pins and mention notices.

### New socket events
| Event | To | Payload |
|-------|----|---------|
| `notification:new` | everyone | `{ title, message, priority }` (an announcement was sent) |
| `reaction:removed` | room | `{ message_id, user_id, emoji }` |
| `status:changed` | everyone | `{ userId, statusId, action: "created" \| "deleted" }` |
| `status:reaction` | `status:<id>` room + the author | `{ statusId, userId, emoji \| null }` |
| `status:view` | `status:<id>` room + the author | `{ statusId, viewerId }` |
| `profile:updated` | that user | `{ userId, is_premium, is_verified, is_suspended, is_monetized }` after an admin action |
| `room:deleted` | room | `{ roomId }` |
| `support:typing` | others in `support:<conversationId>` | `{ conversationId, userId, typing }` |

Emit `support:join` / `support:leave` with a conversation id, then `support:typing` `{ conversationId, typing }`. `room:join` now only works for members.

### Fixed along the way
- Hand-verified users (no application row) no longer lose their badge when a subscription changes.

### Also (frontend F3)
- `GET /api/wallet/transactions` accepts `?source=earning&since=<iso>&limit=<=2000` (default limit 200).

### Also (frontend F4: feed and pages)
- `GET /api/feed/:postId` → one post `{ ...post, profile, is_liked }` (404 if missing or blocked either way).
- `GET /api/pages/posts/:postId` → one page post `{ ...post, page: { id, name, profile_image }, is_liked, is_saved }`.
- Comment lists (`GET /api/feed/:postId/comments`, `GET /api/pages/posts/:postId/comments`) now include `profile: { user_id, display_name, avatar_url, username }` on each comment.
- `GET /api/pages/:pageId/followers` → profiles (first 200). `GET /api/pages/:pageId/owner-following` → pages the owner follows. `GET /api/pages/:pageId/boosts` → boosts on this page's posts (owner or super admin).
- Guests: `GET /api/feed` works without sign-in; `GET /api/pages/feed` needs an account, so guests see user posts only.
