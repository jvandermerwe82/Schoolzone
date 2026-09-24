# Deploying Schoolzone for a pilot

Schoolzone is one Node.js server that serves both the app and the API, with its data in a single SQLite file. It needs:

- a host that can run a Docker container (or Node.js 22+) with a **persistent disk**;
- **HTTPS** in front of it (most hosts provide this automatically);
- an **SMTP email provider** (for email confirmation, password resets and safety alerts);
- optionally, an **Anthropic API key** for the AI tutor.

Pick a host that keeps data in the **UK or EEA** if you can, since that keeps the privacy notice simpler. Record the host's name and region in `docs/privacy-notice.md` and `docs/dpia-draft.md`.

## 1. Build and run

### With Docker (recommended)

```sh
docker build -t schoolzone .
docker run -d --name schoolzone -p 8787:8787 \
  -v schoolzone-data:/data \
  --env-file .env \
  --restart unless-stopped \
  schoolzone
```

- The database is `/data/schoolzone.db` and backups go to `/data/backups`. **`/data` must be a persistent volume**, or everything is lost when the container is replaced.
- The container runs as the unprivileged `node` user and has a health check (`GET /api/health`).

### Without Docker

```sh
npm ci
npm run build
npm start          # NODE_ENV=production; reads .env
```

Keep it running with your host's process manager (e.g. systemd), and set `DATABASE_PATH` and `BACKUP_DIR` to a persistent disk.

## 2. Settings (`.env`)

Copy `.env.example` to `.env` and fill it in. **Never commit `.env`.**

| Setting | What to set |
| --- | --- |
| `NODE_ENV` | `production` (the Docker image sets this) |
| `APP_URL` | The public address, e.g. `https://schoolzone.example.org`. Used in email links. When it starts with `https://`, the server also sends HSTS. |
| `SMTP_URL`, `MAIL_FROM` | From your email provider, e.g. `smtps://USER:PASSWORD@smtp.provider.com:465`. `MAIL_FROM` must be an address the provider allows you to send from. |
| `TRUST_PROXY` | `true` if the host puts a proxy/load balancer in front of the app (most do), so rate limits see the real visitor address. Only set it when the app **can't** be reached except through that proxy. |
| `ANTHROPIC_API_KEY` | From console.anthropic.com. Leave empty to run without the AI tutor. |
| `TUTOR_MODEL`, `TUTOR_EFFORT`, `TUTOR_DAILY_LIMIT` | Defaults: `claude-opus-5`, `medium`, 60 messages per child per day. |
| `ADMIN_TOKEN`, `EXPORT_SALT` | Long random strings (e.g. `openssl rand -hex 32`), for the research exports. Keep `EXPORT_SALT` the same for the whole pilot, or the codes for children change. |
| `ADMIN_EMAIL` | Gets an email when a teacher registers a school, so you can check and approve it. |
| `BACKUP_DIR`, `BACKUP_KEEP` | Where daily backups go and how many days to keep (default 14). |
| `RETENTION_DAYS` | Answer records and tutor chats older than this are deleted (default 365). |

On start, the server prints a warning for any important setting that's missing (SMTP, APP_URL, BACKUP_DIR).

## 3. HTTPS

- Put the app behind HTTPS **before** real families use it. In production, sign-in cookies are marked `Secure`, so sign-in won't work over plain HTTP.
- Most platforms (e.g. managed container hosts) give you HTTPS automatically. On your own server, put a reverse proxy such as Caddy or nginx in front, with a Let's Encrypt certificate, and set `TRUST_PROXY=true`.
- Check: open `https://your-address/api/health`. You should see `"ok":true`, and the response headers should include `strict-transport-security` and `content-security-policy`.

## 4. Check email and the AI tutor

Run these on the server, with the same `.env`:

```sh
npm run check:email -- you@example.com   # sends a test email
npm run check:tutor                      # tests the API key, then two real tutor replies
```

With Docker: `docker exec -it schoolzone npm run check:email -- you@example.com`.

Then do a full run-through: sign up, confirm the email, reset the password, add a child, and try the tutor.

To make sure emails aren't marked as spam, set up **SPF, DKIM and DMARC** for your sending domain, following your email provider's instructions.

## 5. Backups

- The server makes a backup **once a day** into `BACKUP_DIR` (`schoolzone-YYYY-MM-DD.db`), keeping the last `BACKUP_KEEP` days. Make one straight away with `npm run backup`.
- The backups are on the **same disk** as the live database. That protects against mistakes, but not against losing the disk. **Copy them somewhere else every day**, e.g. to object storage in the same region, **encrypted**, with access limited to the people who run Schoolzone. (Example: `age` or `gpg` encryption before upload, or a storage bucket with encryption and tight access rules.)
- Backups contain children's data. They follow the same rules as the database, and old ones must be deleted (the `BACKUP_KEEP` rotation does this locally; set a matching expiry on the off-site copies).

### Restoring

1. Stop the app.
2. Copy the backup over the database file, and delete any `schoolzone.db-wal` and `schoolzone.db-shm` files next to it.
3. Start the app and check `/api/health`.

**Test a restore once before the pilot starts**, on a copy, not the live server.

## 6. Research exports

Only includes families who ticked "Help improve Schoolzone"; names are replaced with codes.

```sh
curl -H "x-admin-token: $ADMIN_TOKEN" https://your-address/api/admin/events.csv -o events.csv
curl -H "x-admin-token: $ADMIN_TOKEN" https://your-address/api/admin/checkpoints.csv -o checkpoints.csv
```

See `docs/evaluation-plan.md` for how to use them.

## 7. Approving schools

When a teacher registers a school, `ADMIN_EMAIL` gets an email. Before approving, **check the person really works at the school** (for example, email the school office using the address on the school's own website, not the one they gave you).

```sh
curl -H "x-admin-token: $ADMIN_TOKEN" https://your-address/api/admin/schools                 # list (pending first)
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" https://your-address/api/admin/schools/ID/approve  # teacher is emailed
curl -X DELETE -H "x-admin-token: $ADMIN_TOKEN" https://your-address/api/admin/schools/ID        # remove (pupils just leave it)
```

## 8. Before inviting families

- [ ] HTTPS works, and the health check is green
- [ ] `check:email` and `check:tutor` pass (if the tutor is on)
- [ ] Backups are copied off the server, encrypted, and a restore has been tested
- [ ] `docs/privacy-notice.md` is completed and reviewed, and published where parents can read it before signing up
- [ ] `docs/dpia-draft.md` is completed and signed off
- [ ] `docs/safeguarding-procedure.md` has a named lead and deputy
- [ ] A Year 6 teacher has reviewed the content (`npm run content:export` → `review/schoolzone-content-review.csv`)
