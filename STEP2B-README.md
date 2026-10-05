# Step 2b: real message ticks (frontend only)

Needs the STEP 1 backend deployed (it adds the delivery tracking + `/rooms/:id/receipts`).
Unzip `step2b-ticks-FRONTEND.zip` over the frontend folder (2 files) and deploy.
NOTE: ChatRoomPage.tsx here is cumulative: it already contains step 2a. Apply this one over 2a.

## What the ticks mean (direct messages)
- one grey tick  = saved on the server
- two grey ticks = reached the other person's device (their app was open or opened)
- two blue ticks = they have the chat open / opened it and saw the message
Group rooms show one tick (per-member delivery isn't tracked for groups).

## Test (two phones, DM between them)
1. B closes the app. A sends a message -> A sees ONE grey tick.
2. B opens the app (not the chat) -> A's tick becomes TWO grey.
3. B opens the chat -> A's ticks turn BLUE.
4. B stays in the chat, A sends another -> it goes grey-two then blue within ~1 second, without B leaving.
