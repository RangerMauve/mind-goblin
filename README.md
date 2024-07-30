# mind-goblin
Your friendly internet enabled assistant. Swap minds with custom prompts and Ollama

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
mind-goblin repl
> enter text here to get a response

// Read in a file and rewrite it according to the prompt
mind-goblin refactor "capitalize each sentance" ./example.txt

// Get files injected into the context
mind-goblin think "summarize this" ./example.txt

// It should use the webcam when possible
mind-goblin think "What do you see?"

// When getting an image file in the cli, use instead of camera
mind-goblin think "What do you see?" ./screenshot.png
```