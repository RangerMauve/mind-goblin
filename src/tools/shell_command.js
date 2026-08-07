import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const name = "shell_command";
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

/**
 * Executes a shell command.
 * @param {object} parameters
 * @param {string} parameters.command The shell command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export default async function (parameters) {
  const { command } = parameters;
  const { stdout, stderr } = await execAsync(command);
  return { stdout, stderr };
}
