# Harbourside Veterinary Clinic

Next.js clinic management app backed by [Neon](https://neon.tech) PostgreSQL.

## Stack

- **Next.js 15** (App Router)
- **Neon** PostgreSQL via `@neondatabase/serverless`
- **TanStack Query** + **shadcn/ui**

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Add your Neon connection string and auth secret to `.env`:

```
DATABASE_URL=postgresql://...
AUTH_SECRET=your-random-secret
```

3. Install dependencies and apply the database schema:

```bash
npm install
npm run db:push
```

4. Create the first admin/staff account (database only — not via signup):

```bash
npm run create-admin -- admin@yourclinic.com "Dr. Admin" "secure-password"
```

5. Start the dev server:

```bash
npm run dev
```

## Accounts & security

| Role | How to sign in |
|------|----------------|
| **Admin / Staff** | Email + password only. Accounts must be created in the database (`npm run create-admin`). |
| **Pet owners** | Sign up with email/password, or **Continue with Google** (verified `@gmail.com` only). |

Google sign-in verifies the Google ID token, requires a verified Gmail address for new pet-owner accounts, and **never** grants admin access automatically.

## Optional environment variables

- `GEMINI_API_KEY` — enables PawBot AI chat (Google Gemini)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth (Console → redirect URI: `{APP_URL}/api/auth/google/callback`)
- `NEXT_PUBLIC_APP_URL` — app URL for OAuth redirects (e.g. `http://localhost:3000`)

## Profile

Click your **name beside the notification bell** in the header to open your profile and view or update your account details.
