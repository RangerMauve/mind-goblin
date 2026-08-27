import { execa } from "execa";

export const readonly = false;
export const name = "speak";
export const description = "Speak a message out loud through the speaker.";
export const parameters = {
  type: "object",
  properties: {
    message: {
      type: "string",
    },
  },
  required: ["message"],
};

/**
 * Speak a message out loud through the speaker.
 * @param {object} parameters
 * @param {string} parameters.message
 * @param {unknown} [_goblin]
 * @param {AbortSignal} [cancelSignal]
 */
export default async function speak({ message }, _goblin, cancelSignal) {
  await execa({
    cancelSignal,
  })`spd-say --stop --wait ${message.replaceAll("\n", " ")}`;
}
