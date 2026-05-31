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

The production Docker container serves the built UI from the backend process.
On Linux, Docker Compose runs it with host networking so host-local services
like Ollama and ComfyUI are reachable at `127.0.0.1` and `localhost`.
`AGENTS_FRONTEND_PORT` is the web UI port used by the production container.

With defaults, the UI is available at `http://localhost:5174`. For example,
this serves the UI on `http://localhost:5175`:

```bash
AGENTS_FRONTEND_PORT=5175
```

App data is persisted in the `agents-data` Docker volume.

When Ollama or ComfyUI are running on the same Linux host, these local endpoint
values work because the container shares the host network namespace:

```bash
AGENTS_OLLAMA_HOST=http://127.0.0.1:11434
AGENTS_COMFYUI_HOST=http://127.0.0.1:8188
```

If you run this Compose file on Docker Desktop for macOS or Windows, host
networking has different behavior. In that case, use the local Bun dev commands
or switch the Compose file back to port publishing plus
`host.docker.internal`.

## Project Structure

- `src/` — backend server, agent loop, tools, and session storage
- `ui/` — React frontend
- `data/` — local persisted data
