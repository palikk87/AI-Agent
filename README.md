# AI-Agent

Archive of AI-built projects. Each top-level directory is a self-contained project with its own
README, backend, and frontend.

## Projects

| Project | Domain | What it is |
| --- | --- | --- |
| [`seemygd/`](seemygd/) | [seemygd.com](https://seemygd.com) | Multi-tenant AI garage door visualizer + repair estimator that garage door companies embed on their own sites. Bun/Hono API, React/Vite frontend, OpenAI `gpt-image-1`, Square subscriptions. |

## Conventions

- **No secrets in git.** Every project ships `.env.example` templates; real `.env` files, SQLite
  databases, and `node_modules` are gitignored (see [`.gitignore`](.gitignore)).
- Each project's own `README.md` is the source of truth for its architecture and endpoints.
