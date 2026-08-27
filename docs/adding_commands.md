# Adding a New Command

Commands are user-facing REPL actions (like `/compact` or `!ls`). Each lives in
its own file under `src/commands/` and is auto-loaded in `Commands.default()`.

## File location

```
src/commands/<name>.js
```

## Module contract

A command module must export **three** things:

| Export     | Type                          | Purpose                              |
|------------|-------------------------------|--------------------------------------|
| `name`     | `string`                      | The trigger prefix (e.g. `/compact`, `!`) |
| `run`      | `(line, context, signal) => void \| Promise<void>` | Executes the command |
| `complete` | `(prefix, context) => string[] \| Promise<string[]>` | Tab-completion (optional) |

- `line` is the raw text *after* the command name.
- `context` is the `REPLContext`. Access the agent via `context.goblin` when needed.
- `signal` is an `AbortSignal` for cancellation.
- `complete` receives the text typed *after* the command name and returns an array of full-suffix completions (the `name` prefix is re-prepended by the framework).

## Minimal example

```js
// src/commands/hello.js
/** @import {REPLContext} from "../repl.js" */

export const name = "/hello";

/**
 * @param {string} line
 * @param {REPLContext} context
 * @param {AbortSignal} [signal]
 */
export async function run(line, context, signal) {
  console.log(`Hello, ${line || "world"}!`);
}

/** @param {string} _ @param {REPLContext} _ctx */
export function complete(_, _ctx) {
  return [];
}
```

## Registering the command

Add a load line in `Commands.default()` (`src/commands.js`):

```js
static async default() {
  const commands = new Commands();
  await commands.load("shell");
  await commands.load("compact");
  await commands.load("hello");   // ← new
  return commands;
}
```

`load` does a dynamic `import(`./commands/${name}.js`)` and reads the three
named exports to call `register`.

## Notes

- **Name prefix matching** is substring-based (`line.startsWith(name)`), so
  choose names that won't accidentally swallow each other (e.g. `/help` vs
  `/help-me` — the shorter one wins if it matches first in insertion order).
- Use `context.goblin` to access the agent (tools, crank, etc.).
- Use `context.push(...)` to inject messages into the conversation (see
  `shell.js` for the `USER` / `ASSISTANT` / `TOOL` message pattern).
- Use `playBell()` from `../ansi.js` when you want a completion chime.
- Import `USER`, `ASSISTANT`, `TOOL` constants from `../index.js` for message roles.
- Keep the file self-contained; only import from `../` siblings.
