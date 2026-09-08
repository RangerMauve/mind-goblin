# Adding a New Command

Commands are user-facing REPL actions (like `/compact` or `!ls`). Each lives in
its own file under `src/commands/` and is auto-loaded in `Commands.default()`.

## File location

```
src/commands/<name>.js
```

## Module contract

A command module must export **four** things:

| Export        | Type                                                          | Purpose                                   |
| ------------- | ------------------------------------------------------------- | ----------------------------------------- |
| `name`        | `string`                                                      | The trigger prefix (e.g. `/compact`, `!`) |
| `description` | `string` g                                                    | Short description shown in `/help`        |
| `default`     | named function `(line, context, commands, signal?) => void \| Promise<void>` | Executes the command                      |
| `complete`    | `(prefix, context) => string[] \| Promise<string[]>`          | Tab-completion (optional)                 |

- `line` is the raw text _after_ the command name.
- `context` is the `REPLContext`. Access the agent via `context.goblin` and the logger via `context.logger` when needed.
- `commands` is the `Commands` instance. Use `commands.descriptions()` to get a `Map<string, string>` of all registered commands (useful for `/help`).
- `signal` is an `AbortSignal` for cancellation.
- `complete` receives the text typed _after_ the command name and returns an array of full-suffix completions (the `name` prefix is re-prepended by the framework).

## Minimal example

```js
// src/commands/hello.js
/** @import {REPLContext} from "../repl.js" */

export const name = "/hello";
export const description = "Print a greeting";

/**
 * @param {string} line
 * @param {REPLContext} context
 */
export default async function hello(line, context) {
  context.logger.assistant(`Hello, ${line || "world"}!`);
}
```

Name the function to match the filename. This shows up in stack traces and the debugger.

If you need cancellation, add the remaining params:

```js
/**
 * @param {string} line
 * @param {REPLContext} context
 * @param {import("../commands.js").Commands} commands
 * @param {AbortSignal} [signal]
 */
export default async function compact(line, context, commands, signal) {
  // ...
}
```

Omit trailing params you don't use — the framework still passes them.

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

`load` does a dynamic `import(`./commands/${name}.js`)` and reads the named exports to call `register`.

## Notes

- **Name prefix matching** is substring-based (`line.startsWith(name)`), so
  choose names that won't accidentally swallow each other (e.g. `/help` vs
  `/help-me` — the shorter one wins if it matches first in insertion order).
- Use `context.goblin` to access the agent (tools, crank, etc.).
- Use `context.logger` for all output (`.user()`, `.assistant()`, `.tool()`, `.info()`, `.quiet()`, `.warn()`).
- Use `context.push(...)` to inject messages into the conversation (see
  `shell.js` for the `USER` / `ASSISTANT` / `TOOL` message pattern).
- Use `playBell()` from `../ansi.js` when you want a completion chime.
- Import `USER`, `ASSISTANT`, `TOOL` constants from `../index.js` for message roles.
- Keep the file self-contained; only import from `../` siblings.
