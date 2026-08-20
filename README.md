# mind-goblin

Your friendly internet enabled assistant. Swap minds with custom prompts and Ollama

## Features

- **Tool Use**: 17 built-in tools including web search, Wikipedia, file operations, shell commands, math calculations, clipboard access, and more
- **Session Persistence**: Save and resume conversations across runs
- **Tab Completion**: File path autocomplete in the REPL
- **Shell Passthrough**: Run shell commands directly from the REPL with a `!` prefix, recording them in the conversation as a tool call
- **Safety Confirmations**: User confirmation required for shell commands and file modifications, with a rendered line diff for `edit_file`
- **Thinking Display**: Optional display of reasoning steps during chat
- **Readline History**: Command history populated when resuming sessions
- **Audio Notifications**: Bell sound on response completion
- **Sub-agents**: Fork specialized agents with limited tool access

## What should it do? (TODO)

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

## Usage

### Global Options

- `--debug`: Output extra debug info to inspect the train of thought

### Commands

#### `mind-goblin think [prompt] [file]`

Think about a query and answer the user.

- `[prompt]`: The task you wish for the assistant to complete.
- `[file]`: File to include in context.
- `--speak`: Speak the answer aloud.

#### `mind-goblin chat`

Have a conversation via the TUI.

- `--show-thinking`: Output thinking blocks to STDOUT.
- `--session <name>`: Resume or start a named session (Default: 'default').
- `--clear`: Clear the session before starting.
- `--thinking-history`: Preserve thinking history. Increases context size but speeds up inference from better caching.

**Shell passthrough:**

Prefix a line with `!` to run a shell command directly without asking the goblin, e.g. `!git status`. The command's output is shown in the terminal and the exchange is recorded in the message history as a `shell_command` tool call (your input as a user message, a synthetic assistant tool call, and the output as a tool response), so the goblin has the result in context for the next turn. Tab completion works for `!` commands too.

#### `mind-goblin transform <prompt> <file>`

Transform a file in place.

- `<prompt>`: The task you wish for the assistant to complete.
- `<file>`: The file to refactor. Must exist; the goblin is forked with only `write_file`/`edit_file` and is blocked from touching any other file.

## Configuration

Mind Goblin uses `rc` for configuration. It looks for `~/.mindgoblinrc` or the `MINDGOBLIN_CONF` environment variable.

**Default Configuration:**

```json
{
  "model": "qwen3.5:4b",
  "server": "http://localhost:11434/v1/",
  "api_key": ""
}
```

- **Model**: The model name to use (e.g., `llama3`, `qwen3.5:4b`).
- **Server**: The URL of the OpenAI-compatible API (defaults to Ollama).
- **API Key**: Your API key (defaults to `OPENAI_API_KEY` env var).

It also uses XDG directories for storing data:

- **Config**: `~/.config/mindgoblin`
- **Data/Sessions**: `~/.local/share/mindgoblin/sessions`

## Examples

**Ask a question and have the answer spoken aloud:**

```bash
mind-goblin think "How do I center a div in CSS?" --speak
```

**Resume a specific session:**

```bash
mind-goblin chat --session "project-alpha"
```

**Transform a file (e.g., fix typos):**

```bash
mind-goblin transform "Fix the typos" ./draft.txt
```

**Debug the assistant's thought process:**

```bash
mind-goblin chat --debug
```
