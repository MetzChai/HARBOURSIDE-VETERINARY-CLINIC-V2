# Harbourside Frontend

Next.js 15 UI for the Harbourside Veterinary Clinic app.

**Full setup, architecture, environment variables, and deployment instructions are in the root README:**

→ [../README.md](../README.md)

## Quick start (after root setup)

```powershell
# From project root
npm run dev
```

Frontend only:

```powershell
npm run dev:frontend
```

Runs at [http://localhost:3000](http://localhost:3000). API requests are proxied to the Express backend via `next.config.ts` rewrites.
