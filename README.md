# Orbis Agents

A local-first agent runtime with a run UI, powered by [Ollama](https://ollama.com/).

Build custom agents directly from the UI. Each agent can have its own system prompt and a configurable set of tools, letting you tailor behavior to specific tasks without touching code.

Custom skills live under **Customization > Skills**. A skill follows the
`SKILL.md` shape: a lowercase hyphenated name, a description that tells agents
when to use it, and Markdown instructions. Agents receive only the skill
metadata until they load a matching skill. Type `$skill-name` in a message to
invoke one directly.

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
AGENTS_SEARXNG_HOST=http://127.0.0.1:8080
```

If these are omitted, the app keeps its existing defaults. Endpoint values saved in the Settings UI take precedence over `.env` endpoint values.

In development, the backend API and Vite UI are separate processes:

- `AGENTS_BACKEND_PORT` controls the API server. Default: `3000`.
- `AGENTS_FRONTEND_PORT` controls the Vite dev server. Default: `5174`.

## Docker

Run with Docker Compose:

```bash
docker compose up
```

The production Docker container is different from development: it serves the
built UI and API from the same backend process, so there is only one app port.
On Linux, Docker Compose runs it with host networking so host-local services
like Ollama and ComfyUI are reachable at `127.0.0.1` and `localhost`.
`AGENTS_BACKEND_PORT` is the web UI/API port used by the production container.

With defaults, the UI is available at `http://localhost:3000`. For example,
this serves the UI on `http://localhost:5174`:

```bash
AGENTS_BACKEND_PORT=5174
docker compose up
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

## Workspaces

Shell commands and file tools use `/workspace` for both private and selected
local workspaces. File tools also accept relative paths within that directory.
The UI shows the selected host directory for local workspaces.

Downloads and file reads require Linux with procfs. They open each path component
without following symlinks and read from the resulting file descriptor. Symlinks
are rejected even when they point inside the workspace.

Temporary workspaces expire after 24 hours. The server checks for expired leases
and abandoned directories every minute, deferring deletion during active turns.
Leaving a temporary chat requests deletion immediately. Selected local directories
are never removed by temporary workspace cleanup.

The sandbox integration tests report skips when Bubblewrap is unavailable. Run
`bun test --preload ./tests/setup.ts tests/sandbox` on a Linux host with working
Bubblewrap namespaces to verify workspace writes and network isolation.

## Project Structure

- `src/` - backend server, agent loop, tools, and session storage
- `ui/` - React frontend
- `data/` - local persisted data
