# Orbis Agents

A local-first agent runtime with a chat UI, powered by [Ollama](https://ollama.com/).

Build custom agents directly from the UI. Each agent can have its own system prompt and a configurable set of tools, letting you tailor behavior to specific tasks without touching code.

## Requirements

- [Bun](https://bun.sh/)
- [Ollama](https://ollama.com/) running locally

## Setup

```bash
bun install
```

## Development

Runs the backend server and UI together.

```bash
bun run dev
```

Individual processes:

```bash
bun run dev:server
bun run dev:ui
```

Optional local overrides can be placed in `.env`. Start from `.env.example`.

```bash
AGENTS_BACKEND_PORT=3000
AGENTS_BACKEND_HOST=127.0.0.1
AGENTS_FRONTEND_PORT=5174
AGENTS_OLLAMA_HOST=http://127.0.0.1:11434
AGENTS_COMFYUI_HOST=http://127.0.0.1:8188
```

If these are omitted, the app keeps its existing defaults. Endpoint values saved in the Settings UI take precedence over `.env` endpoint values.

## Docker

Run with Docker Compose:

```bash
docker compose up
```

The UI is available at `http://localhost:3000` by default. App data is persisted in the `agents-data` Docker volume.

When Ollama or ComfyUI are running on the host machine, set their container-reachable URLs in `.env`:

```bash
AGENTS_OLLAMA_HOST=http://host.docker.internal:11434
AGENTS_COMFYUI_HOST=http://host.docker.internal:8188
```

## Project Structure

- `src/` — backend server, agent loop, tools, and session storage
- `ui/` — React frontend
- `data/` — local persisted data
