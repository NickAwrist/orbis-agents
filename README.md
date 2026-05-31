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
`AGENTS_FRONTEND_PORT` is the host-facing web UI port, and
`AGENTS_BACKEND_PORT` is the port the backend listens on inside the container.

With defaults, the UI is available at `http://localhost:3000`. For example,
this publishes the UI on `http://localhost:5175` while the backend listens on
port `3100` in the container:

```bash
AGENTS_BACKEND_PORT=3100
AGENTS_FRONTEND_PORT=5175
```

App data is persisted in the `agents-data` Docker volume.

When Ollama or ComfyUI are running on the host machine, set their container-reachable URLs in `.env`:

```bash
AGENTS_OLLAMA_HOST=http://host.docker.internal:11434
AGENTS_COMFYUI_HOST=http://host.docker.internal:8188
```

On Linux, `http://127.0.0.1:<port>` and `http://localhost:<port>` from inside
the container refer to the container itself, not the host. The upstream services
also need to listen on a non-loopback interface for Docker to reach them. For
Ollama, set `OLLAMA_HOST=0.0.0.0:11434` for the Ollama service. For ComfyUI,
start it with `--listen 0.0.0.0`.

## Project Structure

- `src/` — backend server, agent loop, tools, and session storage
- `ui/` — React frontend
- `data/` — local persisted data
