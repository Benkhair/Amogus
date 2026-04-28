# 🎭 Imposter Word Game

A real-time multiplayer voice-based deception party game built with **Next.js 16**, **Supabase**, and **LiveKit**.

---

## 🎯 Game Overview

- Minimum **4 players** join a private room using a code
- One player is secretly assigned as the **Imposter**
- All other players (**Sudlats**) receive the same secret word; the Imposter gets a related but different word
- Players take **15-second voice turns** describing their word indirectly
- After all turns, players **vote** to eliminate who they think is the Imposter
- **Sudlats win** if the Imposter is eliminated; **Imposter wins** if they survive

---

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the **SQL Editor**, run the entire contents of `supabase_schema.sql`
3. From **Project Settings → API**, copy your **Project URL** and **anon key**

### 3. Set up LiveKit (optional — for voice chat)

1. Go to [livekit.io](https://livekit.io) and create a free cloud project
2. Copy your **WebSocket URL**, **API Key**, and **API Secret**
3. Voice chat works without LiveKit configured — the UI will show a warning but the game still functions fully

### 4. Configure environment variables

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

NEXT_PUBLIC_LIVEKIT_URL=wss://YOUR_LIVEKIT_HOST
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
```

### 5. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🗂️ Project Structure

```
app/
  page.tsx                  # Home screen (create/join)
  layout.tsx                # Root layout + GameProvider
  room/[code]/page.tsx      # Room page — routes to correct phase screen
  api/
    room/create/            # POST: Create room + first player
    room/join/              # POST: Join room by code
    room/heartbeat/         # POST: Player presence ping
    game/start/             # POST: Assign roles + start game
    game/next-turn/         # POST: Advance to next speaker
    game/vote/              # POST: Submit vote + tally results
    livekit/token/          # POST: Generate LiveKit JWT

components/
  HomeScreen.tsx            # Create/Join UI
  LobbyScreen.tsx           # Waiting room + player list
  GameScreen.tsx            # Turn-based speaking phase
  VotingScreen.tsx          # Vote submission UI
  ResultsScreen.tsx         # Game results + reveal
  VoiceRoom.tsx             # LiveKit voice integration

context/
  GameContext.tsx           # Global game state + Supabase Realtime

hooks/
  useHeartbeat.ts           # Player presence / disconnect detection

lib/
  types.ts                  # TypeScript interfaces
  words.ts                  # Word pair database (40+ pairs, 15 categories)
  session.ts                # localStorage session ID
  roomCode.ts               # Random room code generator
  supabase/client.ts        # Supabase browser client
  supabase/server.ts        # Supabase server client (API routes)
```

---

## 🧩 Database Tables

| Table | Purpose |
|---|---|
| `rooms` | Room metadata, code, host, status |
| `players` | Player info, role, word, connection state |
| `game_state` | Phase, turn order, turn index, timer |
| `votes` | Per-round votes with voter + target |

---

## 🎮 Game Phases

1. **lobby** — Players join, host starts when ≥4 present
2. **speaking** — Turn-based 15s voice rounds, timer auto-advances
3. **voting** — All players vote; results tallied when all votes are in
4. **results** — Winner revealed, full role/word reveal, play again option

---

## ⚙️ Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TailwindCSS v4**
- **Supabase** — Postgres + Realtime subscriptions
- **LiveKit** — WebRTC voice rooms
- **Lucide React** — Icons
