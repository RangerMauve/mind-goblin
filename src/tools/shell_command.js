import { exec } from "child_process";
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
  "head ",
  "tail ",
  "grep ",
  "find ",
  "sort",
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
  "npx tsc ",
  "npx prettier ",
  "npx eslint ",
  "npm test",
  "npm run test",
  "npm run format",
  "npm run lint",
  "npm run build",
  "npm ls",
  "npm show ",
  "npm search ",
  // go
  "go mod verify",
  "go list ",
  "go list -m -mod=mod ",
  "go mod graph",
  // rust
  "cargo check ",
  "cargo metadata",
  "cargo tree ",
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
 * @param {string} command
 * @returns {boolean}
 */
export function isAllowed(command) {
  const idx = command.indexOf(" ");
  const key = idx === -1 ? command : command.slice(0, idx);
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
 * Decide whether a shell command is safe to run without user
 * confirmation. Quoted argument spans are stripped first so
 * metacharacters inside them count as literal data; command
 * substitution inside double quotes still forces confirmation. Compound
 * expressions (joined with &&, ||, &, | or ;) are allowed only if every
 * subcommand is allowed and no find carries an action expression.
 * @param {string} command
 * @returns {boolean}
 */
export function check(command) {
  // Newlines and carriage returns are shell command separators.
  if (/\r|\n/.test(command)) return true;

  // Strip quoted spans so their metacharacters are treated as data.
  const { stripped, doubleQuoted } = stripQuotedArgs(command.trim());
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

  // Every part must be allowed, and find must not carry an action.
  return !subcommands.every(
    (subcommand) => isAllowed(subcommand) && !hasFindAction(subcommand),
  );
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
  },
  required: ["command"],
};

export { SHELL_JOINERS };

/** @import { Goblin } from '../index.js' */

/**
 * Executes a shell command. Read-only agents may only run commands that
 * pass {@link check}; anything else is rejected.
 * @param {object} parameters
 * @param {string} parameters.command The shell command to execute
 * @param {Goblin} agent The agent invoking the tool
 * @param {AbortSignal} [signal] Cancellation signal
 * @returns {Promise<{stdout: string, stderr?: string}>}
 */
export default async function (parameters, agent, signal) {
  const { command } = parameters;
  if (agent?.readonly && check(command)) {
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
