# mind-goblin

![logo](./logo.png)

Your friendly internet enabled assistant.

## Features

- **Tool Use**: 16 built-in tools: `compact`, `context_length`, `edit_file`, `edit_regex`, `fetch`, `get_current_time`, `prune`, `read`, `read_clipboard`, `screenshot`, `search_web`, `shell_command`, `skill`, `sub_agent`, `unskill`, `write_file`
- **Image Reading**: The `read` tool returns image data for image files on the filesystem, and `fetch` returns image data for image URLs, so the goblin can "see" images from both the local disk and the web
- **Screenshots**: The `screenshot` tool captures the full screen via `grim` on Wayland, so the goblin can see what's on your display
- **Session Persistence**: Save and resume conversations across runs
- **Tab Completion**: File path autocomplete in the REPL
- **Shell Passthrough**: Run shell commands directly from the REPL with a `!` prefix, recording them in the conversation as a tool call
- **Safety Confirmations**: User confirmation required for shell commands and file modifications, with a rendered line diff for `edit_file` and a pattern→replacement preview for `edit_regex`
- **Thinking Display**: Optional display of reasoning steps during chat
- **Readline History**: Command history populated when resuming sessions
- **Audio Notifications**: Bell sound on response completion
- **Interjections**: Type a line while the goblin is mid-turn to interrupt its train of thought; it incorporates your message and continues from where it left off
- **Sub-agents**: Fork specialized agents with limited tool access
- **Project Context**: Automatically loads `AGENTS.md` (or `CLAUDE.md`, `QWEN.md`, `GEMINI.md`, `.cursorrules`) from the working directory into the system prompt, so the goblin knows your project conventions
- **Persistent Memory**: Optional `MEMORY.md` file injected into the system prompt. The goblin can read and update it to remember instructions and facts across sessions
- **Voice Input**: Speak to the goblin hands-free via microphone. Uses Silero VAD + Moonshine Tiny (int8) for offline speech-to-text
- **Skills**: Loadable instruction packs (`SKILL.md`) for specific tasks. Discovered across bundled, XDG, and project directories. Load/unload via the `skill`/`unskill` tools or `/skill`/`/unskill` commands
- **Context Warning**: Automatically detects when context usage exceeds 70% of the model's context window (queried from llama-server's `/props` endpoint) and nudges the LLM to use the `prune` tool to free space

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

### `/clear [n]`

Clear the conversation history. Optionally specify how many recent entries to clear. Negative numbers clear from the oldest messages.

### `/fork [name]`

Fork the current history into a new session.

### `/length`

Show the number of messages in the conversation history.

### `/retry`

Remove the last assistant response and re-crank.

### `/resume`

Crank again without resetting the history (continue from where the conversation left off).

### `/skill [name]`

List available skills, or load a skill's instructions into the conversation by name.

### `/unskill [name]`

List active skills, or remove a loaded skill's instructions from the conversation by name.

## What should it do? (TODO)

- look through the camera
- query databases
  - postgres
  - neo4j
  - sqlite

## Usage

### Global Options

- `--debug`: Output extra debug info to inspect the train of thought
- `--model <name>`: Use a named model preset from config (see Model Presets below). Defaults to `default`.
- `--readonly`: Run with only read-only tools. Write tools (`write_file`, `edit_file`, `edit_regex`) and side-effect tools are stripped. Shell commands are restricted to a safe allowlist. Sub-agents inherit readonly mode and can only further restrict tool access.
- `--allow-all`: Allow all tools and writes without confirmation. This turns off the per-call confirm prompts (writes/edits anywhere, and dangerous shell commands) and forces `--readonly` off. Use with care — the goblin will act without asking.
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

See [Built-in Commands](#built-in-commands) for REPL commands like `!`, `/compact`, `/tail`, `/help`, `/clear`, `/fork`, `/retry`, `/skill`, and more.

**Interjections:** While the goblin is working, you can type a line and press Enter to interrupt its train of thought. The interjection is picked up at the next checkpoint (after each model response, between tool batches) and injected as a new user message; the goblin runs a fresh model round with it in context and continues the same turn. Type multiple lines before the next checkpoint and they're combined into a single interjection. Tool work completed before the interjection stays in context for the rest of the turn. Interjections are not saved to the session history — only the final response is. As always, Escape still cancels the entire turn.

#### `mind-goblin transform <prompt> <file>`

Transform a file in place.

- `<prompt>`: The task you wish for the assistant to complete.
- `<file>`: The file to refactor. Must exist; the goblin is forked with only `write_file`/`edit_file`/`edit_regex` and is blocked from touching any other file.

#### `mind-goblin listen`

Listen for voice commands via microphone and respond aloud.

- `--session <name>`: Resume or start a named session (Default: 'default').
- `--clear`: Clear the session before starting.
- `--no-speak`: Don't speak responses, only log them to the terminal.

On first run, it downloads the Silero VAD and Moonshine Tiny English (int8) speech-to-text models into `~/.local/share/mindgoblin/models/`. Audio from the default input device is resampled to 16 kHz, segmented by VAD, transcribed, and sent to the goblin as a user message. New speech interrupts any in-progress response. Press Ctrl+C to stop.

#### `mind-goblin sessions`

List the names of all sessions for the current working directory. Sessions in subdirectories are excluded. Prints one name per line, or `No sessions found.` if there are none.

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
- **memoryFile**: Path to a persistent memory file injected into the system prompt. The goblin is instructed to read and update it with `write_file`/`edit_file` to remember things across sessions. Defaults to `~/.local/share/mindgoblin/MEMORY.md`. Set to `null` to disable.
- **skillsDirs**: Extra directories to scan for skills (`<name>/SKILL.md`). Scanned in priority order after the bundled, XDG config, and XDG data skill dirs but before project-local dirs (`.agents/skills`, `.claude/skills`).

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

**Model Presets:**

Define named model presets in your config to switch between models with different settings. Top-level params are automatically available as the `default` preset.

```json
{
  "model": "qwen3.5:4b",
  "server": "http://localhost:11434/v1/",
  "models": {
    "fast": { "model": "qwen3.5:1b", "temperature": 0.3 },
    "thinker": { "model": "qwen3.5:4b", "temperature": 0.9, "max_tokens": 8192 }
  }
}
```

Select a preset with the `--model` flag (defaults to `default`):

```sh
mind-goblin chat --model fast
mind-goblin think --model thinker "Explain quantum computing"
```

Unknown preset names produce an error listing available models.

It also uses XDG directories for storing data:

- **Config**: `~/.config/mindgoblin`
- **Data/Sessions**: `~/.local/share/mindgoblin/sessions`
- **Memory**: `~/.local/share/mindgoblin/MEMORY.md`
- **Skills**: `~/.config/mindgoblin/skills` and `~/.local/share/mindgoblin/skills`

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
