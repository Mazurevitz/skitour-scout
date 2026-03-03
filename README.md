# SkitourScout

A mobile-first PWA for ski touring route planning in the Polish mountains. Combines real-time weather, avalanche data, and community reports with an AI assistant that answers natural-language questions like *"Find me an easy route with good snow this weekend near Zakopane."*

## AI Features

### Trip Planning Assistant (RAG)
The **Asystent** tab provides a conversational interface backed by Retrieval-Augmented Generation:

```
User query
    │
    ├── Semantic search (pgvector)     ← community reports, admin reports, route data
    ├── Real-time context              ← current avalanche level, temperature, snow depth
    └── LLM (Llama 3.1 8B / OpenRouter)
            │
            └── Polish-language response with route, conditions, hazards, gear
```

- **Embedding model**: OpenAI `text-embedding-3-small` (1536-dim vectors)
- **Vector store**: Supabase pgvector with IVFFlat index
- **LLM**: Llama 3.1 8B via OpenRouter (~$0.0001/query)
- **Context window**: up to 8 most relevant report chunks per query
- **Memory**: session-only (stateless between sessions)

### Route Condition Scoring
Every route gets a 0–100 condition score computed by the `SafetyAgent`, combining:
- Avalanche danger level and aspect alignment
- Fresh snow depth and temperature trend
- Community report recency and relevance weight

### Report Relevance Scoring
Community reports decay in relevance over time, further adjusted by:
- Weather similarity between report time and now (snow, temperature delta)
- Report consistency with other nearby reports
- Time since submission (full weight < 24h, archived > 14 days)

### AI-Aggregated Intel Summary
The **Intel Summary** card calls the `llm-proxy` edge function to synthesise all recent community and admin reports for the selected region into a short Polish-language briefing.

### Facebook Report Ingestion
An automated pipeline scrapes ski touring Facebook groups via Apify, then:
1. `fb-scrape-trigger` — schedules Apify runs on a cron
2. `fb-scrape-process` — filters posts for relevance with an LLM
3. `parse-report` — extracts structured data (location, snow conditions, hazards, safety rating)
4. `import-fb-reports` — inserts verified reports into `admin_reports`

---

## Other Features

- **Avalanche indicator** — TOPR/GOPR danger level with problem aspects (Tatry only)
- **Multi-elevation weather** — valley and summit conditions from Open-Meteo
- **Resort conditions** — snow depth reference from nearby ski resorts
- **Community reports** — user-submitted ascent/descent reports with offline queue
- **Interactive map** — Leaflet with route overlays and clustered report markers
- **Web search** — on-demand search via `search-proxy` edge function
- **PWA** — installable, works offline with cached data

---

## Architecture

```
Frontend (React PWA)
├── MobileDashboard          # 4-tab shell: Overview / Routes / Reports / Asystent
├── agents/
│   ├── WeatherAgent         # Open-Meteo API (multi-elevation)
│   ├── SafetyAgent          # TOPR avalanche + route scoring
│   ├── SocialIntelAgent     # Community report aggregation
│   └── WebSearchAgent       # Web scraping proxy
├── stores/
│   ├── useAppStore          # Weather, routes, avalanche state
│   └── useReportsStore      # Community + admin reports, IndexedDB persistence
└── services/
    ├── assistant.ts         # Chat API wrapper
    ├── llm.ts               # LLM proxy wrapper
    └── retryQueue.ts        # Offline operation queue

Supabase Backend
├── Edge Functions
│   ├── chat-assistant       # RAG pipeline: embed → retrieve → LLM
│   ├── embed-report         # OpenAI embeddings → pgvector storage
│   ├── llm-proxy            # OpenRouter LLM calls (server-side key)
│   ├── submit-report        # Community report ingestion + rate limiting
│   ├── fb-scrape-trigger    # Apify scrape scheduler
│   ├── fb-scrape-process    # LLM relevance filter + report parser
│   ├── import-fb-reports    # Batch import verified FB reports
│   ├── parse-report         # Structured data extraction from raw posts
│   ├── search-proxy         # Web search relay
│   └── topr-proxy           # TOPR avalanche API relay
└── Database (PostgreSQL)
    ├── reports              # Community-submitted reports
    ├── admin_reports        # Verified reports from FB ingestion
    ├── report_embeddings    # pgvector embeddings for RAG
    ├── profiles             # User accounts
    ├── fb_group_configs     # Facebook group scraping config
    ├── scrape_jobs          # Scrape run tracking
    └── scraped_posts        # Raw posts before processing
```

---

## Setup

### Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Supabase project (free tier works)
- OpenRouter API key (free tier available)
- OpenAI API key (for embeddings — `text-embedding-3-small` is ~$0.001/1k reports)

### Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Secrets (for Edge Functions)

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENAI_API_KEY=sk-...
```

### Database Setup

```bash
supabase db push
```

This applies all migrations including:
- Initial schema (reports, profiles, rate limits)
- Admin reports + Facebook ingestion tables
- `report_embeddings` with pgvector and `match_reports()` similarity search function

### Deploy Edge Functions

```bash
supabase functions deploy
```

### Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
```

---

## Backfilling Embeddings

After the first deploy, embed existing reports and route definitions:

```bash
# Embed all existing community reports
curl -X POST https://your-project.supabase.co/functions/v1/embed-report \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reports": [...]}'

# Routes are static — embed once from src/data/routes.ts
```

New reports are embedded automatically when submitted via `submit-report`.

---

## Cost Estimate

| Component | Cost |
|-----------|------|
| Embeddings (`text-embedding-3-small`) | ~$0.001 per 100 reports |
| LLM chat (Llama 3.1 8B via OpenRouter) | ~$0.0001 per query |
| LLM intel summary (same model) | ~$0.0002 per summary |
| FB post filtering + parsing | ~$0.001 per 10 posts |
| Supabase (pgvector, edge functions) | Free tier |
| **Estimated total (100 reports, 500 queries/month)** | **< $1/month** |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS |
| State | Zustand |
| Map | Leaflet + react-leaflet |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Vector search | pgvector (IVFFlat index) |
| Embeddings | OpenAI `text-embedding-3-small` |
| LLM | Llama 3.1 8B via OpenRouter |
| FB scraping | Apify |
| PWA | Vite PWA + Workbox |
| Auth | Supabase Auth (Google, Facebook, email) |
| Offline | IndexedDB + retry queue |

---

## License

MIT
