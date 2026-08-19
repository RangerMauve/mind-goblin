// ANSI escape sequences
export const INFO = "\x1b[92m";
export const WARN = "\x1b[91m";
export const QUIET = "\x1b[90m";
export const ALERT = "\x1b[95m";
export const RESET = "\x1b[0m";
export const BELL = "\x07";

/**
 * Ring the terminal bell.
 */
export function playBell() {
  process.stdout.write(BELL);
}
