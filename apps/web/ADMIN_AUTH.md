# Admin panel authentication

The admin panel (`/admin`) is protected by a simple username/password login. Only people with the credentials can open any `/admin` page.

## How it works

- Visiting `/admin` (or any `/admin/*` except `/admin/login`) without a valid session redirects to **`/admin/login`**.
- After signing in with valid credentials, a signed cookie is set and you can use the admin panel. Session lasts **24 hours**.
- **Sign out** in the sidebar clears the cookie and sends you back to the login page.

## Environment variables (web app)

Set these in `.env.local` (local) and in your hosting dashboard (Vercel, etc.) for production.

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_SESSION_SECRET` | Yes | A long random string used to sign the session cookie (e.g. `openssl rand -base64 32`). |
| `ADMIN_USERNAME` | Yes | Username for the first admin (you or shared). |
| `ADMIN_PASSWORD` | Yes | Password for the first admin. |
| `ADMIN_USERNAME_2` | No | Second admin username (e.g. your partner). |
| `ADMIN_PASSWORD_2` | No | Second admin password. |

**Example (one shared login for you and your partner):**

```env
ADMIN_SESSION_SECRET=your-long-random-secret-from-openssl-rand-base64-32
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

**Example (two separate logins):**

```env
ADMIN_SESSION_SECRET=your-long-random-secret
ADMIN_USERNAME=you
ADMIN_PASSWORD=your-password
ADMIN_USERNAME_2=partner
ADMIN_PASSWORD_2=partner-password
```

If `ADMIN_SESSION_SECRET` is not set, the middleware does not run and `/admin` is not protected (so you can still develop without auth). In production you must set it.

## Generate a secret

```bash
openssl rand -base64 32
```

Use the output as `ADMIN_SESSION_SECRET`.
