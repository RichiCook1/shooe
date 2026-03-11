

# Browser Push Notifications — What's Missing

The current implementation has two gaps:

1. **No push subscription**: The app requests `Notification.permission` but never calls `PushManager.subscribe()` to register the browser with a push service. Without this, the service worker's `push` event listener never fires.

2. **No server-side push sending**: Notifications are stored in the `notifications` table but never trigger a Web Push message. A server component needs to send pushes via the Web Push protocol when a notification is created.

## Implementation Plan

### 1. Generate VAPID Keys & Store as Secrets
- Generate a VAPID key pair (can be done via an edge function or externally)
- Store `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as secrets
- Expose the public key to the frontend via an env variable or edge function

### 2. Create `push_subscriptions` Table
```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
```
With RLS: users can insert/delete their own rows.

### 3. Frontend: Subscribe to Push After Permission Granted
In `AuthContext.tsx`, after `Notification.requestPermission()` succeeds:
- Get the service worker registration
- Call `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
- Save the subscription (endpoint, keys.p256dh, keys.auth) to the `push_subscriptions` table

### 4. Edge Function: `send-push-notification`
- Triggered by a database webhook on `INSERT` into `notifications` table
- Looks up the target user's push subscriptions
- Sends a Web Push message using the `web-push` npm package (or raw fetch with VAPID signing)
- Formats the notification body based on notification type (like, comment, follow, message)

### 5. Database Webhook
- Create a Supabase database webhook on `notifications` table `INSERT` events that calls the `send-push-notification` edge function

This will complete the push notification pipeline: action → notification row inserted → webhook fires → edge function sends Web Push → service worker shows browser notification.

