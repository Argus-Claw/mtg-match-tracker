# MTG Match Tracker

Track your Magic: The Gathering games, stats, and matchups.

## Features

- **Game Logging** — Log games with format, players, decks, commanders, life totals, and more
- **Game History** — Filterable list of all your games with expandable details
- **Stats Dashboard** — Win rates by format, deck, commander, and color identity
- **Head-to-Head Records** — Track your performance against specific opponents
- **Friends System** — Add friends, view their game history, and compare stats
- **Charts & Visualizations** — Win rate over time, format breakdowns, and more
- **Light/Dark Mode** — Persisted theme toggle with deep blue/purple dark theme
- **PWA** — Installable as a mobile app with offline support
- **Mobile-First** — Responsive design with bottom nav on mobile, sidebar on desktop

## Tech Stack

- React 18 + Vite
- Supabase (Auth, Database, Realtime)
- React Router
- Recharts
- CSS Custom Properties (no CSS framework)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd mtg-match-tracker
npm install
```

### 2. Set up Supabase

Follow the detailed instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

Quick version:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration files in `supabase/migrations/` via the SQL editor
3. Enable Google OAuth (optional)
4. Copy `.env.example` to `.env` and fill in your credentials

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Building for Production

### GitHub Pages

```bash
npm run build:ghpages
```

Output in `dist/` with base path `/mtg-match-tracker/`.

### VPS

```bash
npm run build:vps
```

Output in `dist/` with base path `/mtg-stats/`.

### Custom base path

```bash
VITE_BASE=/your-path/ npm run build
```

## Project Structure

```
src/
  components/   — Reusable UI (Button, Card, Modal, Input, etc.)
  pages/        — Page-level components
  hooks/        — Custom hooks (useGames, useFriends, useStats)
  context/      — React contexts (Auth, Theme, Toast)
  lib/          — Supabase client, helpers, constants
  styles/       — CSS custom properties theme system
supabase/
  migrations/   — SQL migration files for all tables + RLS
public/         — PWA manifest, service worker, icons
```

## Database Schema

- **profiles** — User profiles (auto-created on signup)
- **friendships** — Friend requests and relationships
- **games** — Game records with format, date, notes
- **game_players** — Per-player data (deck, commander, life, wins)

All tables use Row Level Security. See migration files for details.

## Supported Formats

Commander, Standard, Modern, Draft, Brawl, Pioneer, Legacy, Vintage, Pauper

## Icons Note

The PNG icons (`icon-192.png`, `icon-512.png`) are SVG placeholders. For production, generate proper PNG icons from `icon.svg` using a tool like [realfavicongenerator.net](https://realfavicongenerator.net).
