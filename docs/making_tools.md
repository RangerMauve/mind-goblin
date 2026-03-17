# How to Create a New Tool

Tools in this system are simple functions that the `Tools` class calls when needed. To create one, follow these steps:

### 1. Create the Module File

Create a new JavaScript file in the `src/tools/` folder (e.g., `my_new_tool.js`).

### 2. Define the Name and Description

At the top of your file, export a `description` string that explains what the tool does along with the `name`. The `name` should be in snake case and match the file name.
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

### 4. Write the Core Function

Export a `default` function. This function receives two arguments:
1.  `parameters`: The data passed by the user.
2.  `agent`: An optional reference to the current running agent. Use this if you need to spawn sub-agents or tasks.

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

### 5. Register the Tool

Edit `src/tools.js` to ensure this new tool is loaded. Add the filename (without the `.js` extension) to the list of tools that `loadTool` registers.

```javascript
// src/tools.js
const newTool = tools.loadTool('my_new_tool');
```

### Summary Checklist
*   [ ] File is in `src/tools/`
*   [ ] `description`/`name` are exported as strings
*   [ ] `parameters` is exported as an object with `type`, `properties`, and `required`
*   [ ] `default` function is exported as async (usually)
*   [ ] JSDoc is documenting the function
*   [ ] Tool is imported in `src/tools.js`
