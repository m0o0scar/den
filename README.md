# Viba

Viba is a local session manager for AI coding agents. It lets you pick a Git repository, start an isolated worktree session, launch an agent CLI in a browser terminal, and manage the session lifecycle from one UI.

![](./docs/poster.jpeg)

## Major Features

- **Isolated Sessions**: Uses `git worktree` to create clean, isolated environments for every task, with automatic per-session branch naming (`viba/<session>`).
- **New Attempt Flow**: Start new sessions pre-filled with context (title, model, prompt, attachments) from any previous session to iterate quickly.
- **Live Preview & Visual Tools**:
  - **Integrated Browser Proxy**: View your running web app side-by-side with the agent.
  - **Element Picker**: Click any element in the preview to automatically resolve its React component source file and insert it into the agent's context.
- **Credential Management**: Securely manage Personal Access Tokens for GitHub/GitLab and API keys for agents (like Codex) via a dedicated UI, encrypted at rest.
- **Session Modes**:
  - **Fast Mode**: Standard execution loop.
  - **Plan Mode**: Instructs the agent to inspect code and present a concrete plan before making changes.
- **Enhanced File Browser**:
    - **Grid & List Views**: Browse files with rich thumbnails or a compact list.
    - **Pinned Shortcuts**: Pin frequently used directories for quick navigation across session restarts.
    - **Clipboard Paste**: Quickly add attachments by pasting files or images directly into the browser.
    - **@ Mention Suggestions**: Intelligent file path suggestions from your tracked repository files.
- **Dual Terminal Workspace**:
  - Left terminal for agent execution.
  - Right terminal for startup/dev scripts.
- **Session Lifecycle Management**:
  - Real-time Git status (ahead/behind counts, uncommitted changes).
  - One-click **Commit**, **Merge**, and **Rebase** operations.
  - **IDE Deep-links**: Open session worktrees directly in VS Code, Cursor, Windsurf, or Antigravity.
  - **Trident Integration**: View complex diffs and merge conflicts in Trident.
- **Robust Session Resume**: Resume any session with full context, preserving original startup flags and model overrides.
- **Async Operations**: Performance-optimized background tasks like session purging to keep the UI responsive.
- **Multi-Agent Support**: Out-of-the-box support for Codex, Gemini, and Cursor Agent, with a customizable provider/model selector.
- **Theme Support**: Automatic Light/Dark mode switching based on system preference, or manual override.
- **Persistent Metadata**: All session data and configurations are stored locally under `~/.viba`.

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + DaisyUI
- `simple-git` for Git/worktree operations
- `ttyd` + `tmux` as the web terminal backend/persistence layer (proxied at `/terminal`)

## Prerequisites

- Node.js and npm
- A system package manager (`viba-cli` attempts to auto-install `ttyd` and `tmux` if missing on macOS/Linux/Windows).
- At least one supported agent CLI installed (e.g. `codex`). `viba-cli` can assist with installing supported agents and their skills.

## Getting Started

Install dependencies and start development:

```bash
npm install
npm run dev
```

The app picks an available port starting at `3200` in development.

Open the local URL printed in your terminal, then:

1. Select a local Git repository.
2. Pick branch/agent/model and optional scripts.
3. Start a session and work inside the generated worktree.

## Run with npx

```bash
npx viba-cli
```

This starts Viba on an available local port (default `3200`).  
You can also pass options:

```bash
npx viba-cli --port 3300
npx viba-cli --dev
```

Published npm packages are expected to include a prebuilt `.next` output, so `npx viba-cli` does not build on the end user's machine.

## Build and Run

```bash
npm run build
npm run start
```

Production start uses port `3200` by default.

Useful package scripts:

```bash
npm run cli          # run the packaged launcher locally
npm run pack:preview # preview files that will be published
```
