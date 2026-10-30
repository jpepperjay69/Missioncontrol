# Mission Control

A nonprofit director app for **St Vincent DePaul of Clearwater**. Built as a standalone
codebase to deploy on [Render](https://render.com) from GitHub.

## What it does

- **Home dashboard** — donor/gift totals, upcoming events, open reminders, unread
  notifications, quick actions, and admin-account management. A "Mission Control home"
  button is on every page.
- **Donors & donations** — add/edit donors, record gifts, per-donor and overall totals.
- **Events & reminders** — fundraising events with an Events / Reminders tab switcher;
  reminders link to events, have due dates, and can be marked done. Event notes live on
  each event.
- **Industry Contacts** — add/edit the organization's outside contacts.
- **Thank-you letters** — built-in templates with placeholders (donor name, amount,
  gift date) generate a personalized letter per donor/gift; letters can be printed.
- **Thrift Store** — Staff, Meeting Notes, Payroll, and Truck Expenses tabs.
- **Receipts** — scan/file a receipt photo or PDF from any device.
- **Forms** — sign-in sheets with a print-friendly view for the door.
- **Multiple admins** — every admin signs in with their own email + password
  (bcrypt-hashed, session cookies). Admins can add/remove admin accounts from Home.
- **Change notifications** — an in-app notification list records: events added or
  changed, event notes added or edited, industry contacts added/changed/removed, and
  due reminders. Email notifications are sent too, once an email provider is configured.

## Tech

Node 20, Express backend, React + Vite + TypeScript frontend, PostgreSQL via the `pg`
driver with plain SQL migrations (no ORM). All queries are parameterized.

## Run it locally

You need Node 20+ and a local PostgreSQL database.

```bash
# 1. Install dependencies
npm --prefix server install
npm --prefix client install

# 2. Create a database and point the server at it
createdb missioncontrol
export DATABASE_URL="postgres://localhost:5432/missioncontrol"
export SESSION_SECRET="a-long-random-string"

# 3. Start the backend (runs migrations automatically on first start)
node server/index.js

# 4. In another terminal, start the frontend dev server
npm --prefix client run dev
```

Open http://localhost:5173. The first screen is one-time setup: create the first admin
account. After that, sign in with that account. (The frontend dev server proxies `/api`
to the backend on port 3001.)

Production-style local check (what Render runs):

```bash
npm --prefix client run build   # builds client/dist
node server/index.js            # serves the built frontend + API on $PORT (default 3001)
```

## Deploy to Render

1. Push this repo to GitHub (e.g. `jpepperjay69/missioncontrol`).
2. In Render, **New → Blueprint**, point it at the repo, and apply. `render.yaml` in
   this repo defines everything: the web service, the managed PostgreSQL database, and
   the daily reminder cron job.
3. Open the web service URL, create the first admin account on the setup screen, and
   add the other admins from the home page's Admin accounts card.

### What render.yaml creates

| Service | Plan | Purpose |
| --- | --- | --- |
| `mission-control-web` (Node web) | 0.5c-512mb (~$7/mo) | Express API + React frontend |
| `mission-control-db` (PostgreSQL) | 0.1c-256mb (~$6/mo) | All app data, including receipt files |
| `mission-control-reminders` (cron, daily 9:00 UTC) | 0.5c-512mb cron (~$1/mo min) | Due-reminder notifications |

Expected total: **~$14/month** at Render's October 2026 list prices. (The free web tier
spins down after inactivity and free Postgres expires, so the paid plans are
the right fit for a production app.) Re-check prices at signup.

### Environment variables

Set automatically by the Blueprint: `DATABASE_URL` (from the database),
`SESSION_SECRET` (generated). Optional, set later in Render's dashboard:

- `RESEND_API_KEY` + `EMAIL_FROM` — enable email notifications via Resend, or
- `SENDGRID_API_KEY` + `EMAIL_FROM` — enable email notifications via SendGrid.

With neither set, notifications still work in-app; email is simply skipped. Never put
keys in the code — add them in Render with "sync: false" so they stay secret.

## Receipt storage

Receipt photos/PDFs are stored as `bytea` in the Postgres database. That is the
simplest setup that survives Render deploys (Render's local filesystem is ephemeral
without a paid persistent disk, which is single-instance only). For a small nonprofit's
receipt volume this is fine. If volume grows, the upgrade path is an S3-compatible
bucket: store the object key in `receipts` instead of `file_data` and serve via
presigned URLs.

## Notes and limits

- Passwords are hashed with bcrypt (via `bcryptjs`, the pure-JS implementation, so
  there is no native build step on Render).
- There is no "forgot password" email flow yet: a signed-in admin resets any
  admin's password from the home page's Admin accounts card (Set password
  button). If every admin is locked out, run the break-glass script from the
  Render service shell: `node reset.js` (resets the first admin; or
  `node reset.js <email>` for a specific one) — it prints a
  one-time temporary password (and stores only its hash) to sign in with.
- Email notifications need a provider key (above); without one, only in-app
  notifications are delivered.
- No sample/demo data is seeded. The only seeded rows are the three built-in
  thank-you letter templates, which are app functionality, not sample records.
