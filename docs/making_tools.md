# How to Create a New Tool

Tools in this system are simple functions that the `Tools` class calls when needed. To create one, follow these steps:

### 1. Create the Module File

Create a new JavaScript file in the `src/tools/` folder (e.g., `my_new_tool.js`).

### 2. Define the Name and Description

At the top of your file, export a `name` string and a `description` string. **The `name` export is required** and must be in snake_case matching the filename.

```javascript
export const name = "my_new_tool";
export const description = "Calculates the square of a given number.";
```

### 3. Define the Parameters

Export a `parameters` object to specify what inputs the tool expects.

```javascript
export const parameters = {
  type: "object",
  properties: {
    number: {
      type: "number",
      description: "The number to square.",
    },
  },
  required: ["number"],
};
```

#### Tools with no parameters

If your tool doesn't take any parameters, export an empty parameters object:

```javascript
export const parameters = { type: "object" };
```

### 4. Write the Core Function

Export a `default` function. This function receives three arguments:

1.  `parameters`: The data passed by the user.
2.  `context`: The session context (`Context` from `src/context.js`). Use `context.goblin` for agent access (e.g. `fork()`), `context.messages` for the conversation history, `context.goblin.readonly` for mode checks.
3.  `signal`: An `AbortSignal` for cancellation. Pass it through to any async I/O.

**Note**: The function can be `async` or sync. Use `async` when making network requests or I/O operations. Simple calculations can be sync.

Use JSDoc types to document the function for code editors and linters.

Inside this function, perform your logic and return a result object.

```javascript
/** @import { Context } from "../context.js" */

/**
 * Calculates the square of a given number.
 * @param {object} parameters
 * @param {number} parameters.number The number to square
 * @param {Context} context
 * @param {AbortSignal} [signal]
 * @returns {Promise<{answer: number}>}
 */
export default async function (parameters, context, signal) {
  const { number } = parameters;

  // Perform calculation
  const result = number * number;

  return { answer: result };
}
```

**Sync example** (simple calculations, context/signal unused):

```javascript
export default function (parameters) {
  return { answer: parameters.number * parameters.number };
}
```

### 5. Set the Readonly Flag

Export a `readonly` boolean to indicate whether this tool is safe in readonly mode. Defaults to `false` if omitted.

```javascript
export const readonly = false; // this tool has side effects
```

Set to `true` for tools that only read state (e.g., `read`, `search_web`, `get_current_time`). Tools with side effects (writes, notifications, speech) should keep `readonly = false`. In readonly mode, tools with `readonly = false` are stripped from the agent's toolset entirely.

Note: `shell_command` is marked `readonly = true` but self-restricts internally — in readonly mode it only allows a safe command allowlist.

### 6. Register the Tool

Edit `src/tools.js` to ensure this new tool is loaded. Add the filename (without the `.js` extension) to the list of tools that `loadTool` registers.

```javascript
// src/tools.js
const newTool = tools.loadTool("my_new_tool");
```

### Summary Checklist

- [ ] File is in `src/tools/`
- [ ] `name` is exported as a string (required, snake_case, matches filename)
- [ ] `readonly` is exported as a boolean (required, `true` for read-only tools)
- [ ] `description` is exported as a string
- [ ] `parameters` is exported as an object (use `{ type: 'object' }` for tools with no params)
- [ ] `default` function is exported (async for I/O, sync for simple logic)
- [ ] JSDoc is documenting the function
- [ ] Tool is imported in `src/tools.js`
