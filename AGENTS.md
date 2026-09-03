# AGENTS.md — mind-goblin

## What this is

A local-first AI assistant CLI. It runs an agentic loop (tool-calling chat) against an OpenAI-compatible API (defaults to Ollama). Includes a REPL, voice input/output, sub-agent forking, and a cancellation system.

## Language & Runtime

- **Plain JavaScript (ESM)** — no TypeScript, no build step.
- **Node.js ≥ 20** — uses `using` declarations, `node:test`, `node:assert`.
- Types are expressed via **JSDoc** comments, checked by `tsc --noEmit`.

## Commands

| Task             | Command                                             |
| ---------------- | --------------------------------------------------- |
| Run tests        | `npm test` (runs `node --test "test/**/*.test.js"`) |
| Lint + typecheck | `npm run lint` (eslint --fix + tsc --noEmit)        |
| Format           | `npm run format` (prettier --write .)               |
| Run the REPL     | `node src/cli.js chat`                              |
| One-shot query   | `node src/cli.js think "prompt"`                    |
| Transform a file | `node src/cli.js transform "prompt" file.js`        |

## Project Structure

```
src/
  index.js          Goblin class — the agentic loop (crank/query)
  tools.js          Tools registry — loads, subsets, calls tools
  tools/            One file per tool (see "Tools" below)
  commands.js       Commands registry for REPL slash-commands
  commands/         One file per command (see "Commands" below)
  cli.js            CLI entry point (commander-based)
  repl.js           Interactive REPL (node:readline)
  cancel.js         Escape-key → AbortSignal resource
  utils.js          chat() API call, config loading (rc + XDG)
  sessions.js       Session persistence (JSONL in XDG data dir)
  listen.js         Voice input mode (sherpa-onnx)
  ansi.js           Terminal helpers (bell, colors)
  progress-logging.js  Progress display utilities
  completor.js      Tab-completion glue
  confirm.js        Confirmation prompts
docs/
  making_tools.md   How to write a new tool
  adding_commands.md How to write a new command
test/
  *.test.js         node:test suites
  helpers.js        Shared test fixtures (makeContext)
```

## Key Conventions

### Tools (`src/tools/*.js`)

Each tool file exports:

- `name` — snake_case string, must match filename
- `description` — shown to the LLM
- `parameters` — JSON Schema object for tool args
- `readonly` — boolean; `true` if safe in readonly mode
- `default` — the tool function: `(parameters, agent, signal) => result`

The `signal` parameter is an `AbortSignal` for cancellation. Always pass it through to any async operation (fetch, exec, etc.).

Register new tools by adding a `tools.loadTool("name")` line in `src/tools.js` → `Tools.default()`.

### Commands (`src/commands/*.js`)

Each command file exports:

- `name` — trigger prefix (e.g. `"/compact"`, `"!"`)
- `run` — `(line, context, signal) => void | Promise<void>`
- `complete` — `(prefix, context) => string[] | Promise<string[]>` (optional)

Register new commands by adding a `commands.load("name")` line in `src/commands.js` → `Commands.default()`.

### Cancellation

- `AbortSignal` threads through: REPL → `Goblin.crank()` → `chat()` / tool calls.
- Interactive cancellation uses `makeCancelSignalResource(input)` which returns a `CancelResource` (`{signal, [Symbol.dispose]}`). Use `using` for auto-cleanup.
- Tools should accept and forward the `signal` to any blocking operations.

### Readonly Mode

- `Goblin({ readonly: true })` filters tools to only those with `readonly = true`.
- `shell_command` is marked readonly but self-restricts to an allowlist internally.
- `Goblin.fork({ readonly })` can override for sub-agents.

### Config

- Loaded via `rc("mindgoblin", defaults)` → reads `~/.mindgoblinrc` (ini format).
- XDG paths for data/sessions: `~/.local/share/mindgoblin/`.

### Testing

- Uses built-in `node:test` + `node:assert/strict`.
- No mocking framework. Tests are self-contained.
- `test/helpers.js` exports `makeContext(t)` which builds a `REPLContext` with a temp session dir and registers cleanup via `t.after()`.
- Run a single file: `node --test test/specific.test.js`

## Code Style

- No semicolons? **Wrong** — semicolons are used. Prettier handles formatting.
- `import`/`export` (ESM), never `require`.
- JSDoc on all exported functions/classes. `@ts-expect-error` sparingly.
- Private class fields use `#` (e.g. `#tools`, `#descriptions`).
- Error messages are user-facing — keep them helpful but concise.

## Commit Messages

Conventional Commits style: `type: summary` or `type(scope): summary`.

| Type       | Use for                                                    |
| ---------- | ---------------------------------------------------------- |
| `feat`     | New capabilities (tools, commands, CLI options)            |
| `fix`      | Bug fixes, edge cases, incorrect behavior                  |
| `refactor` | Restructuring without behavior change                      |
| `perf`     | Performance improvements                                   |
| `test`     | Adding or fixing tests                                     |
| `docs`     | Documentation changes (including AGENTS.md, README, docs/) |
| `chore`    | Housekeeping — formatting, deps, type fixes, config        |

Rules:

- **Lowercase** after the type colon. No trailing period.
- **Scope** is optional but encouraged when the change is localized (e.g. `fix(shell_command):`, `feat(sub_agent):`).
- One line for the summary. Body is optional for multi-paragraph context.
- Don't prefix with "WIP" or "update" — commit in logical units.

## Keeping AGENTS.md Current

Update this file whenever you make a change that would cause a _new_ agent (or a future-you with amnesia) to do something wrong or waste time. Specifically:

**Update when:**

- A new source directory or top-level module is added
- A tool or command changes its contract (new required params, different return shape)
- A build/test/lint command changes
- A new external dependency changes the dev workflow (e.g. needs a native binary, env var)
- A convention is established or retired (e.g. "we now use X instead of Y")
- A gotcha is discovered that cost time to figure out

**Don't update for:**

- Internal refactors that don't change external contracts
- Bug fixes that don't alter structure
- Content changes within existing files

The test: _"Would an agent reading only this file make a mistake or get confused?"_ If yes, update it.

## Gotchas

- There is **no build step**. Edit `.js` directly, run directly.
- The `chat()` function in `utils.js` is the **only** point of LLM contact — all inference goes through it.
- `Goblin.crank()` mutates the `history` array in place (appends messages). `query()` wraps this for the common single-prompt case.
- `fork()` increments `forkDepth` — sub-agents one level deep, and so on.
- `shell_command.js` has a large allowlist for readonly mode. Commands with shell metacharacters (`|`, `;`, `&`, `${`) or redirection force confirmation even when individual parts are allowed.
