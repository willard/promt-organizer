# Prompt Organizer

A desktop app that turns a guided Q&A into a project spec Markdown file you hand to an AI coding agent (Claude Code, Codex, Cursor, …).

Instead of typing a vague one-paragraph prompt, you answer focused questions step by step. The app builds a structured `SPEC.md`, `CLAUDE.md` or `AGENTS.md` live as you type, and flags the gaps that usually make an agent guess wrong.

## Wizard steps

1. **Overview** – name, pitch, project type, new vs. existing codebase, summary
2. **Problem & users** – the pain, who the users are, goals, non-goals
3. **Features** – each with priority (Must / Should / Nice to have) and acceptance criteria, plus key user flows
4. **Tech stack** – languages, frameworks, database, hosting, libraries to use or avoid (with suggestions per project type)
5. **Architecture** – overview, data model entities, integrations, API / interfaces
6. **Quality** – testing, security, performance, accessibility, error handling
7. **Agent rules** – workflow (plan first / iterate / TDD), commands, code style, folder structure, always / never rules
8. **Delivery** – milestones, definition of done, open questions
9. **Review & export** – pick the output format and fix what the spec check finds

## Features

- **Improve with AI**: Claude reviews the spec and proposes missing acceptance criteria, non-goals, milestones and agent rules, and flags contradictions. Each suggestion is editable and is only added when you click Apply (or Apply all)
- **Templates**: start a new spec from a starter (Web app, REST API, CLI tool, Desktop app, Library) with the stack, commands, agent rules, quality bar and definition of done prefilled, or save any spec as your own template, choosing which sections to include
- Live Markdown preview with a completeness meter
- **Spec check**: missing essentials, features without acceptance criteria, and vague words like "fast" or "user-friendly"
- Drafts autosave to the app's user-data folder; switch between multiple specs in the sidebar
- Export `.md` via a native save dialog, copy to clipboard, or save / import a draft as `.spec.json` to share
- Light and dark theme follow the OS

## AI review setup

AI is optional: everything else works offline without a key, and nothing is sent anywhere unless you click **Review my spec**. To hide AI entirely, open **Settings** in the sidebar and untick **Show AI features**.

To use it, open **Settings** in the sidebar and paste an Anthropic API key (from console.anthropic.com), or start the app with `ANTHROPIC_API_KEY` set. The saved key is encrypted with the OS keychain via Electron `safeStorage` and is only used by the main process; the UI never reads it back. If no keychain is available (some Linux setups), the settings dialog warns that the key will be stored unencrypted.

The review uses `claude-opus-5-5` with structured JSON output, so suggestions can be applied straight into the right fields. It sends the generated Markdown of the current spec, nothing else.

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev        # Vite dev server + Electron window with hot reload
npm run dev:web    # UI only, in the browser (drafts go to localStorage)
npm test           # unit tests for the Markdown generator and spec check
npm run build      # typecheck + production build into dist/
npm start          # run Electron against the production build
npm run dist       # package installers (dmg / nsis / AppImage) into release/
```

## Project layout

```
electron/main.cjs        Electron main process: window, file dialogs, draft storage (IPC)
electron/preload.cjs     Exposes a minimal window.api to the renderer (context isolated, sandboxed)
src/lib/spec.ts          Spec data model, defaults, project types, stack suggestions
src/lib/markdown.ts      Spec → Markdown generator
src/lib/lint.ts          Spec check and completeness score
src/lib/templates.ts     Template model, built-in starters, save/apply logic
src/lib/ai.ts            AI review: prompt, JSON schema, response validation, applying suggestions
src/components/AiReview.tsx  AI review panel on the Review step
src/lib/storage.ts       Desktop IPC wrapper with browser fallback
src/components/steps.tsx The wizard questions
src/components/fields.tsx Form controls (text, list, segmented)
src/App.tsx              Layout: sidebar, wizard, preview
```
