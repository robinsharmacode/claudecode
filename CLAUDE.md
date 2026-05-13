# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, prisma generate + migrate
npm run dev          # Dev server with Turbopack (Next.js 15)
npm run dev:daemon   # Dev server in background (logs → logs.txt)
npm run build        # Production build
npm run lint         # ESLint (Next.js config)
npm run test         # Vitest test suite
npm run db:reset     # Reset SQLite database
```

Run a single test file: `npx vitest run src/components/chat/ChatInterface.test.tsx`

## Architecture

**UIGen** is an AI-powered React component generator. Users describe a component in chat; Claude generates/edits code using tool calls; results render live in a sandboxed iframe.

### Data flow

1. User message → POST `/api/chat/route.ts`
2. Route calls `streamText()` (Vercel AI SDK) with the Anthropic provider, streaming back text and tool calls
3. Claude uses two tools: `str_replace_editor` (create/overwrite/patch files) and `file_manager` (rename/delete)
4. Tool results mutate the **VirtualFileSystem** (in-memory; never writes to disk)
5. `FileSystemContext` propagates file changes → `FileTree` + `CodeEditor` update
6. `PreviewFrame` Babel-transpiles the active file in an iframe for live preview
7. On stream completion, project state (messages + serialized VFS) is persisted to SQLite via Prisma

### Key files

| File | Purpose |
|---|---|
| `src/app/api/chat/route.ts` | Streaming endpoint; tool definitions wired to VFS ops |
| `src/lib/file-system.ts` | VirtualFileSystem class — Map-based in-memory FS |
| `src/lib/provider.ts` | Claude Haiku 4.5 provider; MockLanguageModel fallback (no API key) |
| `src/lib/prompts/generation.tsx` | System prompt sent to Claude |
| `src/lib/tools/str-replace.ts` | `str_replace_editor` tool schema |
| `src/lib/tools/file-manager.ts` | `file_manager` tool schema |
| `src/lib/contexts/FileSystemContext.tsx` | React context owning VFS state |
| `src/lib/contexts/ChatContext.tsx` | React context owning message + streaming state |
| `src/components/preview/PreviewFrame.tsx` | Sandboxed iframe with in-browser Babel transpilation |
| `src/lib/auth.ts` | JWT sessions (HttpOnly cookies, 7-day expiry) |
| `prisma/schema.prisma` | SQLite schema: User + Project (messages/files stored as JSON) |

### Environment

- `ANTHROPIC_API_KEY` — optional; omitting it activates MockLanguageModel (returns static Counter/Form/Card components)
- Database: `prisma/dev.db` (SQLite), auto-created by `npm run setup`
