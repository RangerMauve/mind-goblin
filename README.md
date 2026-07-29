# mind-goblin
Your friendly internet enabled assistant. Swap minds with custom prompts and Ollama

## Features

- **Tool Use**: 17 built-in tools including web search, Wikipedia, file operations, shell commands, math calculations, clipboard access, and more
- **Session Persistence**: Save and resume conversations across runs
- **Tab Completion**: File path autocomplete in the REPL
- **Safety Confirmations**: User confirmation required for shell commands and file modifications
- **Thinking Display**: Optional display of reasoning steps during chat
- **Readline History**: Command history populated when resuming sessions
- **Audio Notifications**: Bell sound on response completion
- **Sub-agents**: Fork specialized agents with limited tool access
- **Long-term Memory**: SQLite-backed fact memory with tags
- **Debug Mode**: Optional debug logging for tool calls

## What should it do?

- get voice input or text input
- output either text or voice
- output as notifications
- answer questions you'd ask an llm
- look through either the camera, the screen, or a static image
    - using mplayer on linux
- reach out to external data sources when it is unsure
    - wikipedia
    - npmjs
    - rust crates
- do basic math
- refactor text from the fs or the clipboard
- query databases
    - postgres
    - neo4j
    - sqlite

## Dream api:

```
// Listen for input and output speech
mind-goblin think --listen --speak

// execute task from the prompt and output to stdout
mind-goblin think "text prompt"

// run a repl
mind-goblin chat
> enter text here to get a response

// Read in a file and rewrite it according to the prompt
mind-goblin transform "capitalize each sentance" ./example.txt

// Get files injected into the context
mind-goblin think "summarize this" ./example.txt

// It should use the webcam when possible
mind-goblin think "What do you see?"

// When getting an image file in the cli, use instead of camera
mind-goblin think "What do you see?" ./screenshot.png
```