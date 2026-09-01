# Build Rules

Exact run, typecheck, test, and deploy commands for accords belong here.
Document the exact commands for this repository here.

## Dev server

`npm run dev` — always serves on the fixed port **5173** (`http://localhost:5173`).
The port is pinned in `vite.config.ts` with `strictPort: true`, so if 5173 is taken
vite fails with "Port 5173 is already in use" instead of silently moving to 5174.

Fill in at least:
- Dev server command
- Typecheck command
- Test command
- Production build command
- QA runner command or URL
