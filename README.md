# SkitourScout

A macOS Menu Bar application for ski touring route recommendations with real-time conditions analysis.

## Features

- **Avalanche Danger Indicator**: Real-time danger level (1-5) with trend and problem aspects
- **Weather Data**: Temperature, wind, visibility, fresh snow, and freezing level
- **Route Recommendations**: AI-evaluated routes with condition scores (0-100)
- **Social Intel Feed**: Aggregated conditions reports from ski touring communities
- **MCP Ready**: Integration-ready for Model Context Protocol tools

## Quick Start

### Prerequisites

- Node.js 18+
- Rust (latest stable)
- Tauri CLI: `cargo install tauri-cli`
- macOS 10.15+

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

### Build for Production

```bash
npm run tauri:build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Configuration

### LLM Provider

SkitourScout supports two LLM providers for AI-powered summarization:

#### Option 1: Ollama (Recommended - Local & Free)

1. Install Ollama: https://ollama.com/download
2. Pull a model:
   ```bash
   ollama pull llama3.2
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. In the app Settings, select "Ollama" and the model

#### Option 2: OpenRouter (Cloud API - Free Tier Available)

1. Get a free API key from [openrouter.ai/keys](https://openrouter.ai/keys)
2. In the app Settings, select "OpenRouter"
3. Enter your API key and choose a model (free models available)

Settings are stored locally and never transmitted elsewhere.

### MCP Integration (Optional)

To enable Playwright-based scraping:

1. Install the MCP server: `npm install -g @anthropic-ai/playwright-mcp`
2. Enable in Settings under "MCP Servers"

## Architecture

SkitourScout uses a modular agent architecture:

```
Orchestrator
├── WeatherAgent    (Open-Meteo API)
├── SafetyAgent     (TOPR/GOPR avalanche data)
└── SocialAgent     (FB/IG scraping)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## Project Structure

```
skitour-scout/
├── src/                    # React frontend
│   ├── agents/             # Data fetching agents
│   ├── components/         # UI components
│   ├── stores/             # Zustand state
│   └── types/              # TypeScript types
├── src-tauri/              # Rust/Tauri backend
├── ARCHITECTURE.md         # System architecture
└── CONTRIBUTING.md         # How to contribute
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Adding new agents
- Adding data sources
- Code style guidelines

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Tauri 2.0 (Rust)
- **State**: Zustand
- **Icons**: Lucide React
- **APIs**: Open-Meteo (weather)

## License

MIT
