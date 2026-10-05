# Step 2c: DM list (frontend only)

Needs the STEP 1 backend deployed (it adds GET /api/rooms/dms/summary).
Unzip `step2c-dmlist-FRONTEND.zip` over the frontend folder (2 files) and deploy.
NOTE: api/rooms.ts here is cumulative: it also contains the receipts function from step 2b.

## What changed
- Opening the DM list now makes 2 requests in total (friends + one summary). Before: 2 requests PER FRIEND
  (it opened every chat and downloaded 50 messages each), so it got slower with every friend you added.
- Times like WhatsApp: "14:20" today, "Yesterday", weekday this week, otherwise "26/09/2026".
- Ticks in front of the preview when the last message is yours (one grey / two grey / two blue).
- Previews for video, shared posts, and calls ("Missed voice call" in red, "Outgoing video call", "No answer" ...).
- The unread time/number is highlighted; the list refreshes by itself when a message or call arrives, and when you return to the tab.
- Tapping a chat opens it directly (no extra request).

## Test
1. Open DMs: the list appears quickly; open browser dev tools > Network: you should see /friends and /rooms/dms/summary only (no per-friend calls).
2. Have a friend message you while you're on the list: that row jumps to the top with a number, without reloading.
3. Send a message, go back to the list: your row shows a tick before the preview text.
4. Missed call from a friend: the row shows a red "Missed voice call".
If the backend isn't updated yet, the list still opens (friends only, no previews) instead of breaking.
