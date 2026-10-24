# Voter Witness 2027 - Backend

Node.js (ES modules) + Express + MongoDB Atlas + Cloudinary. Channels: web form, SMS, hotline/voice.

## Run it
```bash
cp .env.example .env      # fill in MONGODB_URI, JWT secrets, WEBHOOK_SECRET, Cloudinary
npm install
npm run seed              # creates the first admin from SEED_ADMIN_*
npm run import:pu -- polling_units.csv   # code,name,state,lga,ward,lat,lng
npm run dev
```

## Roles
- **observer**: submits reports, sees only their own
- **moderator**: reviews reports (scoped to `assignedStates`, or national if empty), changes status, assigns, adds notes
- **admin**: everything, plus user management and reopening closed reports

## API (all under /api, JSON responses `{ success, data, meta? }`)
| Method | Path | Who |
|---|---|---|
| POST | /auth/login, /auth/refresh | public (rate limited) |
| POST | /auth/logout, GET /auth/me | any logged-in user |
| POST/GET | /users, PATCH /users/:id | admin |
| POST | /reports (multipart: fields + up to 5 `media` files, 10MB each) | observer/moderator/admin |
| GET | /reports (filters: status, category, severity, channel, lga, from, to, q, page, limit) | scoped by role |
| GET | /reports/:id | scoped by role |
| PATCH | /reports/:id/status `{status, note}` | moderator/admin |
| PATCH | /reports/:id/assign `{assignedTo}` | moderator/admin |
| POST | /reports/:id/notes `{note}` | moderator/admin |
| GET | /stats/summary | moderator/admin |
| POST | /webhooks/sms, /webhooks/voice | provider, header `x-webhook-secret` |

Status flow: `new -> under_review -> verified -> escalated/resolved`; `rejected` and `escalated` require a note.

## SMS format
`VW <POLLING_UNIT_CODE> <TYPE> <message>`, e.g. `VW 26-05-03-012 VIOLENCE Thugs at the gate`
TYPE: VIOLENCE VOTEBUY BALLOT THREAT LATE RESULT SUPPRESS BVAS LOGISTICS OTHER.
Replies are clipped to one 160-char segment to protect the SMS budget. Senders whose phone matches a registered user are marked verified; others are flagged `reporterVerified: false`.

## Before go-live
- Confirm the SMS and voice provider, then adapt `services/sms.js` and the field names in `commsController` to their payloads.
- Load the real polling-unit list; SMS/voice reports need it to resolve location.
- Voice reports without a resolvable polling unit are parked as "unresolved" (no state), visible to admins and national moderators only.
- Not included (per proposal scope): penetration testing, automated tests, backups config (use Atlas backups), uptime monitoring.
