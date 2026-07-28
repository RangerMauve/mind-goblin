# How to Create a New Tool

Tools in this system are simple functions that the `Tools` class calls when needed. To create one, follow these steps:

### 1. Create the Module File

Create a new JavaScript file in the `src/tools/` folder (e.g., `my_new_tool.js`).

### 2. Define the Name and Description

At the top of your file, export a `name` string and a `description` string. **The `name` export is required** and must be in snake_case matching the filename.

```javascript
export const name = 'my_new_tool'
export const description = 'Calculates the square of a given number.'
```

### 3. Define the Parameters

Export a `parameters` object to specify what inputs the tool expects.
```javascript
export const parameters = {
  type: 'object',
  properties: {
    number: {
      type: 'number',
      description: 'The number to square.'
    }
  },
  required: ['number']
}
```

#### Tools with no parameters

If your tool doesn't take any parameters, export an empty parameters object:

```javascript
export const parameters = { type: 'object' }
```

### 4. Write the Core Function

Export a `default` function. This function receives two arguments:
1.  `parameters`: The data passed by the user.
2.  `agent`: An optional reference to the current running agent. Use this if you need to spawn sub-agents or tasks.

**Note**: The function can be `async` or sync. Use `async` when making network requests or I/O operations. Simple calculations can be sync.

Use JSDoc types to document the function for code editors and linters.

Inside this function, perform your logic and return a result object.
```javascript
/**
 * Calculates the square of a given number.
 * @param {object} parameters
 * @param {number} parameters.number The number to square
 * @returns {Promise<{answer: number}>}
 */
export default async function (parameters, agent) {
  const { number } = parameters;
  
  // Perform calculation
  const result = number * number;
  
  return { answer: result };
}
```

**Sync example** (simple calculations):
```javascript
export default function (parameters) {
  return { answer: parameters.number * parameters.number };
}
```

### 5. Register the Tool

Edit `src/tools.js` to ensure this new tool is loaded. Add the filename (without the `.js` extension) to the list of tools that `loadTool` registers.

```javascript
// src/tools.js
const newTool = tools.loadTool('my_new_tool');
```

### Summary Checklist

*   [ ] File is in `src/tools/`
*   [ ] `name` is exported as a string (required, snake_case, matches filename)
*   [ ] `description` is exported as a string
*   [ ] `parameters` is exported as an object (use `{ type: 'object' }` for tools with no params)
*   [ ] `default` function is exported (async for I/O, sync for simple logic)
*   [ ] JSDoc is documenting the function
*   [ ] Tool is imported in `src/tools.js`
