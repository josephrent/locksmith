## Admin Access Control (Network-Gated, No In-App Auth)

### Goal
Protect the Admin Console and Admin APIs while:
- Keeping all customer-facing flows fully authless
- Allowing admin access from **any IP/location**
- Avoiding building user accounts, login screens, or auth logic in-app

---

### Chosen Approach: Cloudflare Access (Zero Trust)

Admin access is protected **at the network edge**, not inside application code.

Cloudflare Access must block all unauthorized requests **before** they reach:
- Admin UI routes
- Admin API routes

---

### Protected Routes

The following routes are **NOT publicly accessible**:

- `/admin/*`  
- `/api/admin/*`

All other routes (customer flows, public APIs) remain open.

---

### Cloudflare Configuration Requirements

1. **Cloudflare DNS**
   - Domain must be proxied through Cloudflare

2. **Access Application**
   - Type: Self-hosted
   - Domain: `<your-domain>`
   - Path rules:
     - `/admin*`
     - `/api/admin*`

3. **Access Policy**
   - Allow only:
     - Specific email addresses OR
     - A trusted email domain (e.g. `@company.com`)
   - Authentication provider:
     - Google OAuth (recommended)
   - Optional but recommended:
     - Require MFA

4. **Default Behavior**
   - Any request to protected routes **without Access approval**
     - Must be blocked (403)
     - User is redirected to Cloudflare Access login

---

### Application Assumptions

- The application **does not implement admin authentication**
- If a request reaches `/admin/*` or `/api/admin/*`, it is trusted
- No login UI or admin user tables exist in-app

---

### Optional Hardening (Recommended)

Cloudflare Access can inject identity headers into approved requests (e.g. user email).

If enabled:
- Backend may log admin identity for auditing
- Admin actions (assign, cancel, refund, override dispatch) should write an entry to `audit_events` with:
  - actor_email (from Access header)
  - action_type
  - entity_id
  - timestamp

The backend **must not** rely on these headers for authorization, only logging.

---

### Security Guarantees

- Admin routes are unreachable from the public internet
- Customer flows remain frictionless (no auth)
- Admin access works from any IP or network
- Access can be revoked instantly by removing an email from Cloudflare policy

---

### Non-Goals

- No IP allowlisting
- No VPN requirement
- No password-based admin login
- No session or token handling in application code

---

### Validation Checklist

- Visiting `/admin` from an unauthorized browser is blocked
- Visiting `/admin` from an allowlisted account succeeds
- Public routes remain accessible without authentication
- Admin APIs cannot be accessed without passing Cloudflare Access

---

END ADMIN ACCESS CONTROL
