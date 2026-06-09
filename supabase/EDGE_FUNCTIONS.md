# Supabase Edge Functions — deploy & Postman

## Deploy all functions

```bash
cd "/Users/user/Desktop/DERSLER/4 -- sinif/donem 2/ios/etkinlikYonetim/EtkinlikYonetim"
npx supabase functions deploy
```

Or deploy individually:

```bash
npx supabase functions deploy list-events
npx supabase functions deploy list-my-participant-statuses
npx supabase functions deploy get-event-details
npx supabase functions deploy create-event
npx supabase functions deploy update-event
npx supabase functions deploy delete-event
npx supabase functions deploy create-task
npx supabase functions deploy update-task
npx supabase functions deploy delete-task
npx supabase functions deploy create-participant
npx supabase functions deploy update-participant
npx supabase functions deploy delete-participant
npx supabase functions deploy find-user-by-email
npx supabase functions deploy respond-to-invitation
npx supabase functions deploy admin-stats
npx supabase functions deploy admin-list-events
npx supabase functions deploy admin-list-users
```

## API reference

Base URL: `https://ggrtavmlclgxmhzjuozn.supabase.co/functions/v1`

All endpoints require: `Authorization: Bearer <access_token>` and header `apikey: <anon_key>`.

| Function | Method | Body |
|----------|--------|------|
| list-events | GET | — |
| list-my-participant-statuses | POST | `{ "event_ids": ["uuid"] }` |
| get-event-details | POST | `{ "event_id": "uuid" }` |
| create-event | POST | event + optional `tasks`, `participant_emails` |
| update-event | PATCH | `{ "id", "title", ... }` |
| delete-event | DELETE | `{ "id": "uuid" }` |
| create-task | POST | `{ "event_id", "title", ... }` |
| update-task | PATCH | `{ "id", ... }` |
| delete-task | DELETE | `{ "id": "uuid" }` |
| create-participant | POST | `{ "event_id", "email", ... }` |
| update-participant | PATCH | `{ "id", "email", ... }` |
| delete-participant | DELETE | `{ "id": "uuid" }` |
| find-user-by-email | POST | `{ "email": "..." }` |
| respond-to-invitation | POST | `{ "event_id", "response": "accepted" \| "declined" }` |
| admin-stats | GET | admin only |
| admin-list-events | GET | admin only |
| admin-list-users | GET | admin only |

## Admin user setup

In Supabase Dashboard → Authentication → Users → select user → User Metadata:

```json
{ "role": "admin" }
```

Admin APIs use service role after verifying `role === "admin"`.

## Postman login

**POST** `https://ggrtavmlclgxmhzjuozn.supabase.co/auth/v1/token?grant_type=password`

Headers: `apikey`, `Content-Type: application/json`  
Body: `{ "email": "...", "password": "..." }`

Copy `access_token` for all function calls.

## App

Business logic uses `lib/api/*` — not direct `supabase.from()` for data.  
Auth (login/signup) still uses `supabase.auth` in the app.
