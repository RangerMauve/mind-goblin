/** @import { Context } from "../context.js" */
import { exec } from "child_process";
import { resolve, sep } from "node:path";
import { promisify } from "util";

const execAsync = promisify(exec);

const noInteractive = {
  PAGER: "cat",
  GIT_PAGER: "cat",
  EDITOR: "true",
  GIT_EDITOR: "true",
  VISUAL: "true",
  GIT_TERMINAL_PROMPT: "0",
};

const ALLOWED_COMMANDS_LIST = [
  // Allow cd into subdirs for convenience
  `cd ${process.cwd()}`,
  // Common utilities for controling the machine
  "bluetoothctl",
  "upower",
  "mpc",
  // Info about the machine
  "ls ",
  "cat ",
  "pwd",
  "whoami",
  "hostname",
  "date",
  "uname",
  // File system and shell status
  "echo ",
  "printf ",
  "head ",
  "tail ",
  "grep ",
  "find ",
  "sort",
  "cut",
  "jq ",
  "stat ",
  "df ",
  "ps ",
  "id ",
  "env",
  "printenv",
  "wc ",
  "which ",
  "sed -n ",
  // version checks
  "go version",
  "node --version",
  "npx node --version",
  "python --version",
  "ruby --version",
  "cargo --version",
  "pnpm --version",
  "yarn --version",
  // git
  "git diff ",
  "git status",
  "git log ",
  "git show ",
  "git branch ",
  "git remote -v",
  // github cli
  "gh issue list ",
  "gh issue status",
  "gh issue view ",
  "gh pr list ",
  "gh pr status",
  "gh pr checks ",
  "gh pr diff ",
  "gh pr view ",
  "gh repo list ",
  "gh repo view ",
  "gh search code ",
  "gh search commits ",
  "gh search issues ",
  "gh search prs ",
  "gh search repos ",
  "gh run list ",
  "gh run view ",
  "gh run watch ",
  "gh release list ",
  "gh release view ",
  "gh label list ",
  "gh gist list ",
  "gh gist view ",
  "gh project list ",
  "gh project view ",
  "gh project field-list ",
  "gh project item-list ",
  "gh status",
  "gh browse ",
  "gh --version",
  // node / js
  "node --test",
  "npx node --test",
  "node --test-only",
  "npx node --test-only",
  "npx tsc ",
  "npx prettier ",
  "npx eslint ",
  "npm test",
  "npm run test",
  "npm run format",
  "npm run lint",
  "npm run build",
  "npm run type",
  "npm run types",
  "npm run check",
  "npm ls",
  "npm show ",
  "npm view ",
  "npm search ",
  // go
  "go mod verify",
  "go list ",
  "go list -m -mod=mod ",
  "go mod graph",
  // rust
  "cargo check ",
  "cargo clippy",
  "cargo search ",
  "cargo metadata",
  "cargo tree ",
  "cargo test ",
  // python / venv
  "pip list ",
  "pip show ",
  "poetry show ",
  "uv pip list ",
  "uv pip show ",
  // gradle
  "gradle dependencies",
  "gradle projects",
  "gradle tasks",
];

// Map from command name (first word) to a Set of allowed entries.
// Lets isAllowed() do an O(1) lookup by command instead of scanning
// every entry.
const ALLOWED_COMMANDS = new Map();
for (const entry of ALLOWED_COMMANDS_LIST) {
  const idx = entry.indexOf(" ");
  const key = idx === -1 ? entry : entry.slice(0, idx);
  let set = ALLOWED_COMMANDS.get(key);
  if (!set) {
    set = new Set();
    ALLOWED_COMMANDS.set(key, set);
  }
  set.add(entry);
}

// Shell metacharacters that join multiple commands or expand
// variables. Any of these turn the input into a compound expression
// whose parts are each checked against the allowlist.
const DANGEROUS_PATTERNS = ["&", ";", "${", "|"];

// Shell metacharacters that can smuggle file writes/reads or extra
// execution past the command allowlist. Any of these force confirmation.
const REDIRECT_OR_SUBSTITUTION = [">", "<", "$(", "`"];

// find(1) is allowlisted for read-only queries, but these action
// expressions can delete files or run arbitrary commands.
const FIND_ACTIONS = ["-delete", "-exec", "-execdir", "-ok", "-okdir"];

const SHELL_JOINERS = /\s*(?:&&|\|\||&|;|\|)\s*/g;

/**
 * Check if a command matches an allowed command.
 * Entries match exactly or as a space-separated prefix, so
 * "ls " allows "ls" and "ls -la" but not "lsfoo".
 * Special case: `cd` is allowed to the cwd or any subdirectory.
 * @param {string} command
 * @returns {boolean}
 */
export function isAllowed(command) {
  const idx = command.indexOf(" ");
  const key = idx === -1 ? command : command.slice(0, idx);

  // cd is allowed to cwd and its subdirectories (resolved to prevent
  // ../ escapes).
  if (key === "cd") {
    const target = command.slice(idx === -1 ? command.length : idx + 1).trim();
    if (!target) return false;
    const resolved = resolve(target);
    return (
      resolved === process.cwd() || resolved.startsWith(process.cwd() + sep)
    );
  }

  const entries = ALLOWED_COMMANDS.get(key);
  if (!entries) return false;
  for (const cmd of entries) {
    const base = cmd.replace(/\s+$/, "");
    if (command === base || command.startsWith(base + " ")) return true;
  }
  return false;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function hasDangerousPatterns(command) {
  return DANGEROUS_PATTERNS.some((pattern) => command.includes(pattern));
}

/**
 * Detect shell redirection (>, <, >>) and command substitution
 * ($( ... ) and backtick ` ... `). These can smuggle file
 * writes/reads or extra execution past the command allowlist, so
 * their presence always forces confirmation.
 * @param {string} command
 * @returns {boolean}
 */
export function hasRedirectionOrSubstitution(command) {
  return REDIRECT_OR_SUBSTITUTION.some((token) => command.includes(token));
}

/**
 * Detect find(1) action expressions (-delete, -exec, -execdir, -ok,
 * -okdir). The base `find` command is allowlisted, but these
 * expressions can destroy data or run arbitrary commands.
 * @param {string} command
 * @returns {boolean}
 */
export function hasFindAction(command) {
  if (!/^\s*find(?:\s|$)/.test(command)) return false;
  return FIND_ACTIONS.some((action) =>
    new RegExp(`(?:^|\\s)${action}(?:\\s|$)`).test(command),
  );
}

/**
 * Walk the command and remove quoted argument spans (single- and
 * double-quoted) so that shell metacharacters inside quotes are
 * treated as literal data rather than operators. Returns the command
 * with every quoted span replaced by a space, plus the raw contents of
 * each double-quoted span. Double quotes still expand command
 * substitution, so their contents are returned for a separate check;
 * single quotes are fully literal and need none.
 * Returns { stripped: null } when a quote is unterminated, which the
 * caller treats as unsafe.
 * @param {string} command
 * @returns {{ stripped: string | null, doubleQuoted: string[] }}
 */
export function stripQuotedArgs(command) {
  let stripped = "";
  const doubleQuoted = [];
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'") {
      const end = command.indexOf("'", i + 1);
      if (end === -1) return { stripped: null, doubleQuoted };
      stripped += " ";
      i = end + 1;
    } else if (ch === '"') {
      let j = i + 1;
      let content = "";
      while (j < command.length && command[j] !== '"') {
        if (command[j] === "\\" && j + 1 < command.length) {
          content += command[j + 1];
          j += 2;
          continue;
        }
        content += command[j];
        j += 1;
      }
      if (j >= command.length) return { stripped: null, doubleQuoted };
      doubleQuoted.push(content);
      stripped += " ";
      i = j + 1;
    } else {
      stripped += ch;
      i += 1;
    }
  }
  return { stripped, doubleQuoted };
}

/**
 * Skip leading flag arguments and return the remainder as the inner
 * command. Used by prefix commands whose own options all start with
 * "-" (time, nohup, xargs). Returns null when no non-flag argument
 * remains, i.e. the wrapper wraps nothing.
 * @param {string[]} args
 * @returns {string | null}
 */
function firstNonFlag(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) i++;
  return i < args.length ? args.slice(i).join(" ") : null;
}

/**
 * Skip nice(1)'s own arguments: the `-n <num>` form, a bare `-<num>`
 * priority, `--`, and any other leading flag. Returns the remainder as
 * the inner command, or null when nothing is wrapped.
 * @param {string[]} args
 * @returns {string | null}
 */
function skipNiceFlags(args) {
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--") {
      i++;
      break;
    }
    if (args[i] === "-n") {
      i += 2;
      continue;
    }
    if (/^-\d+$/.test(args[i])) {
      i++;
      continue;
    }
    if (args[i].startsWith("-")) {
      i++;
      continue;
    }
    break;
  }
  return i < args.length ? args.slice(i).join(" ") : null;
}

/**
 * Skip timeout(1)'s own arguments: any leading `--flag` (e.g.
 * --signal, --kill-after) and the single duration operand (an integer
 * or decimal number with an optional s/m/h/d suffix). Returns the
 * remainder as the inner command, or null when nothing is wrapped.
 * @param {string[]} args
 * @returns {string | null}
 */
function skipTimeoutArgs(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith("--")) i++;
  if (i < args.length && /^\d+(\.\d+)?[smhd]?$/.test(args[i])) i++;
  return i < args.length ? args.slice(i).join(" ") : null;
}

/**
 * Registry of prefix (transparent) commands: commands whose safety is
 * entirely that of the command they wrap. Each entry's `extract`
 * consumes the wrapper's own flags/operands and returns the inner
 * command string, or null when no inner command can be identified.
 *
 * To add a new transparent wrapper, add one entry here — it is then
 * automatically unwrapped by {@link unwrap} before every safety check.
 * @type {Record<string, { extract: (args: string[]) => string | null }>}
 */
const PREFIX_COMMANDS = {
  timeout: { extract: skipTimeoutArgs },
  time: { extract: firstNonFlag },
  nice: { extract: skipNiceFlags },
  nohup: { extract: firstNonFlag },
  xargs: { extract: firstNonFlag },
};

const MAX_UNWRAP_DEPTH = 16;

/**
 * Unwrap a command through any prefix commands down to the innermost
 * command. A prefix command (timeout, time, nice, nohup, xargs) has no
 * safety of its own, so it is stripped of its own arguments and the
 * search continues on the wrapped command. Returns the innermost
 * command string, or null when a prefix command wraps nothing (which
 * the caller treats as unsafe) or the unwrap depth is exceeded.
 * @param {string} command
 * @returns {string | null}
 */
export function unwrap(command) {
  let current = command.trim();
  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth++) {
    const spaceIdx = current.indexOf(" ");
    const head = spaceIdx === -1 ? current : current.slice(0, spaceIdx);
    const prefix = PREFIX_COMMANDS[head];
    if (!prefix) return current;
    const args =
      spaceIdx === -1
        ? []
        : current
            .slice(spaceIdx + 1)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    const inner = prefix.extract(args);
    if (inner === null) return null;
    current = inner.trim();
  }
  return null;
}

/**
 * Detect command substitution ($(...) or backticks) inside a
 * double-quoted string. Unlike single quotes, double quotes still
 * expand substitutions, so these would execute arbitrary commands.
 * @param {string} content
 * @returns {boolean}
 */
export function hasQuotedCommandSubstitution(content) {
  return content.includes("$(") || content.includes("`");
}

/**
 * Split a multiline command into logical lines. Handles backslash
 * continuations (a trailing `\` merges the line with the next). Blank
 * lines and full-line comments are skipped.
 * @param {string} command
 * @returns {string[]}
 */
export function splitLines(command) {
  const lines = [];
  let current = "";
  for (const rawLine of command.split(/\r\n|\n|\r/)) {
    const trimmed = rawLine.trim();
    // Skip blank lines and comments when starting a new logical line.
    if (current === "" && (trimmed === "" || trimmed.startsWith("#"))) {
      continue;
    }
    // Backslash continuation: strip the trailing backslash, add a space,
    // and keep accumulating.
    if (trimmed.endsWith("\\")) {
      current += rawLine.trimEnd().slice(0, -1) + " ";
    } else {
      lines.push(current + rawLine);
      current = "";
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/**
 * Check a single (already newline-free) shell command line for safety.
 * Quoted argument spans are stripped first so metacharacters inside
 * them count as literal data; command substitution inside double quotes
 * still forces confirmation. Compound expressions (joined with &&, ||,
 * &, | or ;) are allowed only if every subcommand is allowed and no
 * find carries an action expression. Each subcommand is unwrapped
 * through any prefix command (timeout, time, nice, nohup, xargs) to its
 * innermost command before these checks, so a wrapper can't mask a
 * dangerous command.
 * @param {string} line
 * @returns {boolean}
 */
export function checkLine(line) {
  // Strip quoted spans so their metacharacters are treated as data.
  const { stripped, doubleQuoted } = stripQuotedArgs(line.trim());
  // Unterminated quoting can't be parsed safely.
  if (stripped === null) return true;

  // Command substitution inside double quotes still executes.
  if (doubleQuoted.some(hasQuotedCommandSubstitution)) return true;

  // Strip out common patterns and collapse the spaces left by quoting.
  const cleaned = stripped
    .replaceAll("2>&1", "")
    .replaceAll("2>/dev/null", "")
    .replace(/\s+/g, " ")
    .trim();

  // Redirection and command substitution always need confirmation
  if (hasRedirectionOrSubstitution(cleaned)) {
    return true;
  }

  // Split into subcommands if it's a compound expression, otherwise
  // treat the whole command as a single subcommand.
  const subcommands = hasDangerousPatterns(cleaned)
    ? cleaned.split(SHELL_JOINERS).map((part) => part.trim())
    : [cleaned.trim()];

  // Unwrap each part to its innermost command, then require it to be
  // allowlisted and free of destructive find actions. Checking the
  // unwrapped form means a wrapper (e.g. `timeout 10`) can't mask a
  // dangerous inner command such as `find . -delete`.
  return !subcommands.every((subcommand) => {
    const inner = unwrap(subcommand);
    return inner !== null && isAllowed(inner) && !hasFindAction(inner);
  });
}

/**
 * Decide whether a shell command is safe to run without user
 * confirmation. Multiline commands are split into logical lines
 * (handling backslash continuations, skipping blanks and comments) and
 * each line is checked independently. If any line is not safe, the
 * whole command requires confirmation.
 * @param {string} command
 * @returns {boolean}
 */
export function check(command) {
  const lines = splitLines(command);
  return lines.some((line) => checkLine(line));
}

export const name = "shell_command";
export const readonly = true;
export const description = "Executes a shell command and returns the output.";

export const parameters = {
  type: "object",
  properties: {
    command: {
      type: "string",
      description: "The shell command to execute.",
    },
    summary: {
      type: "string",
      description:
        "A very short summary of what this command does, e.g. 'list test files'.",
    },
  },
  required: ["command", "summary"],
};

export { SHELL_JOINERS };

/** @import { Goblin } from '../index.js' */

/**
 * Executes a shell command. Read-only agents may only run commands that
 * pass {@link check}; anything else is rejected.
 * @param {object} parameters
 * @param {string} parameters.command The shell command to execute
 * @param {Context | undefined} context The context invoking the tool
 * @param {AbortSignal} [signal] Cancellation signal
 * @returns {Promise<{stdout: string, stderr?: string}>}
 */
export default async function (parameters, context, signal) {
  const { command } = parameters;
  if (context?.goblin?.readonly && check(command)) {
    throw new Error(
      `Rejected: read-only agents may only run allowlisted commands, but "${command}" is not on the list.`,
    );
  }
  try {
    const { stdout } = await execAsync(command, {
      env: { ...process.env, ...noInteractive },
      signal,
    });
    return { stdout };
  } catch (err) {
    if (err.stderr || err.stdout) {
      return { stderr: err.stderr ?? "", stdout: err.stdout ?? "" };
    }
    throw err;
  }
}
