# DCC Project Manager

Crew project management app for Denver Commercial Coatings (DCC) — a single
Node/Express service that serves a React (Vite) frontend and a SQLite
database, built for three subcontractor crews working from phones in the field.

## Stack

- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3` (file on a persistent volume)
- Frontend: React (Vite), built to static files and served by the same
  Express app — one deployable service
- Auth: signed session cookies (custom SQLite-backed session store) + bcrypt
- Uploads: `multer` → resized with `sharp` → stored on the volume
- SMS: Twilio
- Translation: Anthropic API
- PWA: installable via manifest + service worker, but works fine as a plain
  mobile site too

## Local development

Requirements: Node 20+.

```bash
npm install                  # installs server deps
npm install --prefix client  # installs client deps
cp .env.example .env         # fill in what you have; Twilio/Anthropic can stay blank
npm run seed                 # creates admin + 3 crew accounts, prints temp passwords ONCE
```

Run the backend and frontend in two terminals during development:

```bash
npm run dev:server   # Express on :3000 (auto-restarts on change)
npm run dev:client   # Vite dev server on :5173, proxies /api to :3000
```

Visit `http://localhost:5173`. Log in with one of the usernames printed by
`npm run seed` (`alex`, `rmpp`, `lucas`, `quali`) and the temporary password
shown in the terminal — it is only ever printed once, so copy it down. Change
it from the Team screen after logging in (as admin, use "Reset password" on
each user; crews should change theirs the same way once you build a
self-service flow, or ask the admin to reset it for them).

To run the whole thing as a single service the way it runs in production:

```bash
npm run build   # builds client into client/dist
npm start        # Express serves the API + the built client on :3000
```

Without `TWILIO_*` or `ANTHROPIC_API_KEY` set, the app runs fine — SMS sends
are silently skipped (feed notifications still work) and the Español toggle
shows "Translation unavailable" instead of erroring.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | port Express listens on |
| `DATABASE_PATH` | path to the SQLite file, e.g. `/data/app.db` |
| `UPLOADS_PATH` | path to the uploads directory, e.g. `/data/uploads` |
| `SESSION_SECRET` | long random string for signing session cookies |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS sending — omit to disable SMS |
| `ANTHROPIC_API_KEY` | Spanish translation — omit to disable translation |
| `APP_URL` | public base URL, used to build links in SMS (e.g. `https://field.dccpaint.com`) |

## Deploying to Railway

1. **Create the service.** New project → Deploy from GitHub repo. Railway
   will detect Node and run `npm install` then `npm start` — but we need the
   client built first, so set:
   - Build command: `npm run build`
   - Start command: `npm start`

   (`npm run build` installs the client's own deps and runs `vite build`
   into `client/dist`; `npm start` just runs the Express server, which
   serves that folder statically.)

2. **Attach a volume.** In the service's Settings → Volumes, add a volume
   and mount it at `/data`. This is where the SQLite file, uploaded photos,
   and nightly backups live — without it, every deploy wipes your data.

3. **Set environment variables** (Settings → Variables):
   ```
   DATABASE_PATH=/data/app.db
   UPLOADS_PATH=/data/uploads
   SESSION_SECRET=<generate a long random string>
   APP_URL=https://field.dccpaint.com
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=...
   ANTHROPIC_API_KEY=...
   ```
   `PORT` is set automatically by Railway — don't override it.

4. **First users are created automatically.** The server seeds the admin +
   3 crew accounts itself on first boot if the `users` table is empty — no
   shell access needed. Open the **Deployments** tab → click the active
   deployment → **View Logs**, and look near the top for the temporary
   passwords it printed. They aren't stored anywhere and won't be shown
   again, so copy them down now. Change them from the Team screen (or have
   the admin reset them) once everyone's logged in.

5. **Point the custom domain.** In Settings → Networking → Custom Domain, add
   `field.dccpaint.com` and create the CNAME record Railway gives you at your
   DNS provider. HTTPS is handled automatically by Railway.

6. **Twilio A2P 10DLC registration.** Twilio requires A2P 10DLC brand and
   campaign registration before you can send SMS to US numbers at any volume
   beyond low-throughput testing. Register the brand (DCC) and a campaign
   (e.g. "customer care / notifications") in the Twilio console under
   Messaging → Regulatory Compliance before relying on SMS in production —
   this can take a few days to approve, so start it early. Until it's
   approved, the app still works fine; SMS sends will just fail silently
   and notifications still show up in the in-app Alerts feed.

## Adding a new crew

Crews are just `role = 'crew'` user rows — nothing is hardcoded to the three
launch crews. As the admin:

1. Go to **Team** → **+ Add crew**.
2. Enter the crew's display name, a short chip name (used everywhere as
   their color-coded badge), a chip color, and phone number.
3. The app generates a username and a temporary password, shown once on
   screen — write it down and give it to the crew.
4. New crews get the standard default alert preferences (schedule, project,
   scope, color, and order alerts on; photo, note, and receipt off) — adjust
   from their Team card if needed.

They can log in immediately and will only see projects assigned to their crew.

## Backups

A nightly SQLite backup script keeps the last 14 backups on the volume:

```bash
npm run backup
```

This writes a timestamped copy to `<data dir>/backups/` and deletes any
beyond the most recent 14. Schedule it with Railway's cron feature (or any
external scheduler that can hit a one-off command on the service) to run
nightly.

To download a backup: open a shell on the Railway service (`railway shell`
or the web shell) and copy the file out of `/data/backups/`, e.g. with
`railway run cat /data/backups/app-<timestamp>.db > local-backup.db` or by
attaching a temporary object-storage upload step — Railway doesn't expose
the volume over HTTP directly, so pulling files off it means either a shell
session or a small authenticated download route.

## Health check

`GET /health` returns `{ "status": "ok" }` — point Railway's health check at
this path.

## Phase 2 (not built yet, kept compatible)

- Two-way translation (crew writes a Spanish note → admin sees English)
- Web push as a free supplement to SMS
- Per-project document attachments (PDF plans/specs)
- Job costing fields on receipts (dollar amounts)
