# Project

A Next.js admin dashboard with Supabase backend.

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Set up environment variables
Copy the example file and fill in your values:
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key
- `ADMIN_PASSWORD` — password for the admin dashboard

### 4. Run the development server
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack
- [Next.js 14](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
