const ALLOWED_COMMANDS = [
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

const DANGEROUS_PATTERNS = ["&", "${", "|"];

// Shell metacharacters that can smuggle file writes/reads or extra
// execution past the command allowlist. Any of these force confirmation.
const REDIRECT_OR_SUBSTITUTION = [">", "<", "$("];

const SHELL_JOINERS = /\s*(?:&&|\|\||&|\|)\s*/g;

/**
 * Check if a command matches an allowed command.
 * Entries match exactly or as a space-separated prefix, so
 * "ls " allows "ls" and "ls -la" but not "lsfoo".
 * @param {string} command
 * @returns {boolean}
 */
export function isAllowed(command) {
  return ALLOWED_COMMANDS.some((cmd) => {
    const base = cmd.replace(/\s+$/, "");
    return command === base || command.startsWith(base + " ");
  });
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function hasDangerousPatterns(command) {
  return DANGEROUS_PATTERNS.some((pattern) => command.includes(pattern));
}

/**
 * Detect shell redirection (>, <, >>) and command substitution ($( ... )).
 * These can smuggle file writes/reads or extra execution past the command
 * allowlist, so their presence always forces confirmation.
 * @param {string} command
 * @returns {boolean}
 */
export function hasRedirectionOrSubstitution(command) {
  return REDIRECT_OR_SUBSTITUTION.some((token) => command.includes(token));
}

/**
 * Decide whether a shell command needs user confirmation.
 * Compound expressions (joined with &&, ||, &, |) are allowed
 * only if every subcommand is allowed.
 * @param {string} command
 * @returns {boolean}
 */
export function shouldConfirm(command) {
  if (command.includes("\n")) return true;

  // Strip out common patterns
  const stripped = command
    .trim()
    .replaceAll("2>&1", "")
    .replaceAll("2>/dev/null", "");

  // Redirection and command substitution always need confirmation
  if (hasRedirectionOrSubstitution(stripped)) {
    return true;
  }

  // Check subcommands if it's a compound expression
  if (hasDangerousPatterns(stripped)) {
    return !stripped
      .split(SHELL_JOINERS)
      .every((subcommand) => isAllowed(subcommand.trim()));
  }
  return !isAllowed(stripped);
}

export {
  ALLOWED_COMMANDS,
  DANGEROUS_PATTERNS,
  REDIRECT_OR_SUBSTITUTION,
  SHELL_JOINERS,
};
