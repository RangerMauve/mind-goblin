# mind-goblin

Your friendly internet enabled assistant.

## Features

- **Tool Use**: 9 built-in tools: `get_current_time`, `read_clipboard`, `read`, `write_file`, `edit_file`, `load_web_text`, `search_web`, `sub_agent`, `shell_command`
- **Session Persistence**: Save and resume conversations across runs
- **Tab Completion**: File path autocomplete in the REPL
- **Shell Passthrough**: Run shell commands directly from the REPL with a `!` prefix, recording them in the conversation as a tool call
- **Safety Confirmations**: User confirmation required for shell commands and file modifications, with a rendered line diff for `edit_file`
- **Thinking Display**: Optional display of reasoning steps during chat
- **Readline History**: Command history populated when resuming sessions
- **Audio Notifications**: Bell sound on response completion
- **Sub-agents**: Fork specialized agents with limited tool access
- **Project Context**: Automatically loads `AGENTS.md` (or `CLAUDE.md`, `QWEN.md`, `GEMINI.md`, `.cursorrules`) from the working directory into the system prompt, so the goblin knows your project conventions
- **Voice Input**: Speak to the goblin hands-free via microphone. Uses Silero VAD + Moonshine Tiny (int8) for offline speech-to-text

## Built-in Commands

REPL commands available in `mind-goblin chat`:

### `! <command>`

Run a shell command directly without asking the goblin. The command's output is shown in the terminal and the exchange is recorded in the message history as a `shell_command` tool call (your input as a user message, a synthetic assistant tool call, and the output as a tool response), so the goblin has the result in context for the next turn. Tab completion works for `!` commands.

### `/compact`

Summarize and compact the conversation history. First asks the goblin for a short summary of what was discussed, decisions made, and tasks completed. Then strips all tool calls, tool responses, reasoning blocks, and empty messages from the history, replacing them with just the summary. Reports how many of each were removed.

### `/tail [n]`

Show the last `n` user and assistant messages from the conversation (default: 5, max: 50). Tool messages and empty messages are skipped. Useful for quickly reviewing recent context without scrolling.

### `/help [command]`

Show a description of a specific command, or list all available commands if no name is given. Tab completion suggests command names as you type.

## What should it do? (TODO)

- look through either the camera, the screen, or a static image
  - using mplayer on linux
- query databases
  - postgres
  - neo4j
  - sqlite

## Usage

### Global Options

- `--debug`: Output extra debug info to inspect the train of thought
- `--readonly`: Run with only read-only tools. Write tools (`write_file`, `edit_file`) and side-effect tools (`desktop_notification`, `speak`) are stripped. Shell commands are restricted to a safe allowlist. Sub-agents inherit readonly mode and can only further restrict tool access.
- `--no-agents-md`: Don't load agent instruction files (`AGENTS.md`, `CLAUDE.md`, etc.) into the system prompt. Enabled by default.

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

See [Built-in Commands](#built-in-commands) for REPL commands like `!`, `/compact`, `/tail`, and `/help`.

#### `mind-goblin transform <prompt> <file>`

Transform a file in place.

- `<prompt>`: The task you wish for the assistant to complete.
- `<file>`: The file to refactor. Must exist; the goblin is forked with only `write_file`/`edit_file` and is blocked from touching any other file.

#### `mind-goblin listen`

Listen for voice commands via microphone and respond aloud.

- `--session <name>`: Resume or start a named session (Default: 'default').
- `--clear`: Clear the session before starting.
- `--no-speak`: Don't speak responses, only log them to the terminal.

On first run, it downloads the Silero VAD and Moonshine Tiny English (int8) speech-to-text models into `~/.local/share/mindgoblin/models/`. Audio from the default input device is resampled to 16 kHz, segmented by VAD, transcribed, and sent to the goblin as a user message. New speech interrupts any in-progress response. Press Ctrl+C to stop.

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
- **agentsMd**: When `true` (default), load the first agent instruction file found in the working directory (`AGENTS.md`, `CLAUDE.md`, `QWEN.md`, `GEMINI.md`, `.cursorrules`) and append it to the system prompt. Set to `false` or use `--no-agents-md` to disable.

**Optional Sampling Parameters:**

These are passed through to the API as-is. Omit them to use the server's defaults.

- `temperature`: Sampling temperature (e.g., `0.7`).
- `top_p`: Nucleus sampling threshold (e.g., `0.9`).
- `top_k`: Number of highest-probability tokens to sample from (e.g., `40`).
- `max_tokens`: Maximum number of tokens to generate.
- `frequency_penalty`: Penalty for repeated tokens (e.g., `0.5`).
- `presence_penalty`: Penalty for tokens that already appear in the prompt (e.g., `0.3`).
- `stop`: Array of strings that stop generation when encountered (e.g., `["\n"]`).
- `seed`: Fixed seed for reproducible output (e.g., `42`).

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

**Talk to the goblin hands-free:**

```bash
mind-goblin listen
```

**Talk in a specific session without audio output:**

```bash
mind-goblin listen --session "kitchen-talk" --no-speak
```

**Debug the assistant's thought process:**

```bash
mind-goblin chat --debug
```
