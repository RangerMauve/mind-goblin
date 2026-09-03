import { INFO, QUIET, ALERT, color as _color } from "./ansi.js";

/**
 * @param {string} _
 * @param {string} text
 */
function echo(_, text) {
  return text;
}

/**
 * Formatted message logger with per-role helpers.
 */
export class Logger {
  /** @type {(msg: string) => void} */
  #log;
  /** @type {typeof _color | typeof echo} */
  #color;

  /**
   * @param {object} [opts]
   * @param {(msg: string) => void} [opts.log]
   * @param {boolean} [opts.useColors]
   */
  constructor({ log = console.log, useColors = true } = {}) {
    this.#log = log;
    this.#color = useColors ? _color : echo;
  }

  /** @param {string} text */
  user(text) {
    this.#log(this.#color(QUIET, text));
  }

  /** @param {string} text */
  assistant(text) {
    this.#log(text);
  }

  /** @param {string} text */
  tool(text) {
    this.#log(this.#color(INFO, text));
  }

  /** @param {string} text */
  quiet(text) {
    this.#log(this.#color(QUIET, text));
  }

  /** @param {string} text */
  info(text) {
    this.#log(this.#color(INFO, text));
  }

  /** @param {string} text */
  warn(text) {
    this.#log(this.#color(ALERT, text));
  }
}
