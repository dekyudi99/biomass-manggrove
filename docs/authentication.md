# Authentication setup

## Local configuration

1. Copy the repository-root `.env-example` to `.env` and set a strong,
   randomly generated `BIOMASS_DB_PASSWORD`.
2. Copy `backend-fastapi/.env-example` to `backend-fastapi/.env` if it does
   not already exist. Generate a separate random `JWT_SECRET_KEY` with at
   least 32 characters. Keep both files private; they are ignored by Git.
3. Start the services with `docker compose up -d --build`. Compose waits for
   PostgreSQL, applies Alembic migrations, and then starts FastAPI.
4. For Gmail, enable 2-Step Verification and create an App Password. Set
   `SMTP_USERNAME` and `SMTP_FROM_EMAIL` to the Gmail account (or a verified
   sender alias), set `SMTP_PASSWORD` to the App Password, and keep port `587`
   with `SMTP_USE_TLS=true`. Do not commit or log the App Password.

The SMTP sender uses plain-text and HTML alternatives, a stable sender name,
`Date`, `Message-ID`, and `Reply-To` headers, and a short account-verification
message. Those choices improve mail compatibility but cannot guarantee inbox
placement. For a custom sending domain, publish SPF and DKIM records and an
appropriate DMARC policy with the DNS provider. Sending reputation and provider
limits also affect delivery.

## Production

- Terminate HTTPS at the public reverse proxy and set `APP_ENV=production` in
  the repository-root `.env`. This makes secure auth cookies the default.
- Keep `AUTH_COOKIE_SECURE=true`, use explicit frontend origins in
  `CORS_ORIGINS`, and never use `*` with credentialed cookies.
- Keep the frontend and API on the same site where practical. If they must be
  cross-site, configure `AUTH_COOKIE_SAMESITE=none` and retain
  `AUTH_COOKIE_SECURE=true`.
- Configure DNS SPF/DKIM/DMARC for the actual `SMTP_FROM_EMAIL` domain. Gmail
  App Passwords authenticate SMTP but do not configure custom-domain DNS.

## Authentication endpoints

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/login` — sets an `HttpOnly` session cookie; the JWT is not
  returned in the response body.
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/logout`
- `GET /api/auth/csrf` — bootstraps the signed double-submit CSRF cookie/token
  used for state-changing requests.