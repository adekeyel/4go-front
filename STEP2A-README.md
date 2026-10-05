# Step 2a: instant sending + stay-connected fix (frontend only)

Unzip `step2a-instant-send-FRONTEND.zip` over the frontend folder (3 files) and deploy.
No backend change needed beyond step 1 (step 1's messages.ts echoes `client_id`; without it this still works).

## Test
1. Send a message: it appears at once with a small clock, then the clock disappears when saved. Never twice.
2. Turn on airplane mode, send a message: it stays with "Not sent  Retry  Delete". Turn airplane mode off, tap Retry: it sends.
3. Open a chat on phone A, lock the phone for ~1 minute, send messages to it from phone B, unlock A: the missed messages appear
   (before: nothing until a reload, and new messages stopped arriving live).
4. Send a message while scrolled up a bit: the chat jumps to the bottom to show it.
