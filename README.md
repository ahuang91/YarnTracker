# YarnTracker

A webapp for tracking knitting and crochet projects. Built with React, Vite, and a Neon (PostgreSQL) backend. Deployed on Vercel with serverless API functions.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Vercel serverless functions (`/api`)
- **Database**: [Neon](https://neon.tech) (serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **Auth**: JWT cookies via `jose`, passwords hashed with `bcryptjs`

## Project Structure

```
yarn-tracker/
├── api/                    # Vercel serverless API functions
│   ├── auth/
│   │   ├── admin.ts        # Set/check admin status
│   │   ├── login.ts        # Login endpoint
│   │   ├── logout.ts       # Logout endpoint
│   │   ├── me.ts           # Current user session
│   │   ├── reset-password.ts
│   │   ├── security-question.ts
│   │   └── signup.ts
│   ├── lib/
│   │   └── auth.ts         # JWT helpers
│   └── storage.ts          # Key-value storage API
├── src/
│   ├── components/
│   │   ├── AdminPage.tsx
│   │   ├── AuthScreen.tsx
│   │   ├── LoginForm.tsx
│   │   ├── ResetPasswordForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── YarnTracker.tsx # Main app component
│   ├── db/
│   │   ├── index.ts        # Drizzle client
│   │   └── schema.ts       # Database schema
│   ├── lib/
│   │   ├── auth-context.tsx # Auth state / React context
│   │   └── storage.ts      # Client-side storage helpers
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── migrations/             # Drizzle migration files
├── drizzle.config.ts
├── vite.config.ts
└── vercel.json
```

## Running Locally

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) account with a database (free tier works)

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd yarn-tracker
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```env
POSTGRES_URL=<your-neon-connection-string>
JWT_SECRET=<a-long-random-secret-string>
ADMIN_USERNAME=<optional-username-to-auto-promote-to-admin>
```

- `POSTGRES_URL` — find this in your Neon dashboard under **Connection Details** (use the pooled connection string)
- `JWT_SECRET` — any long random string; used to sign auth cookies
- `ADMIN_USERNAME` — (optional) a username that will automatically be granted admin on login

### 3. Run database migrations

```bash
npx drizzle-kit migrate
```

### 4. Start the development server

```bash
npx vercel dev
```

The app will be available at `http://localhost:3000`.

> **Note:** You must use `npx vercel dev` (not `npm run dev`) for local development. The API routes (`/api`) are Vercel serverless functions and won't execute when running Vite directly — Vite will serve the raw TypeScript source instead, causing JSON parse errors.

## Other Development Commands

| Command | Description |
|---|---|
| `npx vercel dev` | Start local dev server (frontend + API) |
| `npm run dev` | Start Vite only — API routes will not work |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit studio` | Open Drizzle Studio to browse/query the database |
| `npx drizzle-kit generate` | Generate a new migration from schema changes |
| `npx drizzle-kit migrate` | Apply pending migrations |
