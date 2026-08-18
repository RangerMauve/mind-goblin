import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  shouldConfirm,
  isAllowed,
  hasDangerousPatterns,
  hasRedirectionOrSubstitution,
} from "../src/command_check.js";

test("isAllowed allows bare ls", () => {
  assert.ok(isAllowed("ls"));
});

test("isAllowed allows ls with args", () => {
  assert.ok(isAllowed("ls -la"));
});

test("isAllowed allows cat with a file", () => {
  assert.ok(isAllowed("cat package.json"));
});

test("isAllowed rejects commands not in the list", () => {
  assert.equal(isAllowed("rm -rf /"), false);
  assert.equal(isAllowed("curl http://evil.example"), false);
});

test("isAllowed requires a word boundary after the command", () => {
  assert.equal(isAllowed("pwdx"), false);
  assert.equal(isAllowed("catfish"), false);
});

test("isAllowed allows exact matches", () => {
  assert.ok(isAllowed("git status"));
  assert.ok(isAllowed("npm test"));
  assert.ok(isAllowed("go version"));
});

test("isAllowed allows allowed commands with extra args", () => {
  assert.ok(isAllowed("git status -s"));
  assert.ok(isAllowed("git diff HEAD~1"));
  assert.ok(isAllowed("npm ls react"));
});

test("hasDangerousPatterns detects joiners and substitution", () => {
  assert.ok(hasDangerousPatterns("ls && rm -rf /"));
  assert.ok(hasDangerousPatterns("ls | rm -rf /"));
  assert.ok(hasDangerousPatterns("echo ${HOME}"));
  assert.equal(hasDangerousPatterns("ls -la"), false);
});

test("shouldConfirm auto-allows the repro command", () => {
  assert.equal(shouldConfirm("ls && cat package.json | head -30"), false);
});

test("shouldConfirm auto-allows simple allowed commands", () => {
  assert.equal(shouldConfirm("ls"), false);
  assert.equal(shouldConfirm("pwd"), false);
  assert.equal(shouldConfirm("cat package.json"), false);
});

test("shouldConfirm allows allowed compound commands", () => {
  assert.equal(shouldConfirm("ls && cat package.json"), false);
  assert.equal(shouldConfirm("git status && git diff"), false);
  assert.equal(shouldConfirm("ls | head -5"), false);
});

test("shouldConfirm allows stripped stderr redirection", () => {
  assert.equal(shouldConfirm("ls 2>&1"), false);
  assert.equal(shouldConfirm("ls 2>/dev/null"), false);
});

test("shouldConfirm rejects unknown commands", () => {
  assert.ok(shouldConfirm("rm -rf /"));
  assert.ok(shouldConfirm("curl http://evil.example"));
});

test("shouldConfirm rejects compounds with a disallowed part", () => {
  assert.ok(shouldConfirm("ls && rm -rf /"));
  assert.ok(shouldConfirm("rm -rf / && ls"));
  assert.ok(shouldConfirm("ls | rm -rf /"));
  assert.ok(shouldConfirm("ls || rm -rf /"));
});

test("shouldConfirm rejects multi-line commands", () => {
  assert.ok(shouldConfirm("ls\nrm -rf /"));
});

test("shouldConfirm rejects empty subcommands from leading joiners", () => {
  assert.ok(shouldConfirm("&& ls"));
});

test("hasRedirectionOrSubstitution detects > < and $(", () => {
  assert.ok(hasRedirectionOrSubstitution("cat f > /tmp/x"));
  assert.ok(hasRedirectionOrSubstitution("cat f >> /tmp/x"));
  assert.ok(hasRedirectionOrSubstitution("cat < /etc/passwd"));
  assert.ok(hasRedirectionOrSubstitution("cat $(rm -rf /)"));
  assert.equal(hasRedirectionOrSubstitution("ls -la"), false);
});

test("shouldConfirm forces confirmation on output redirection", () => {
  assert.ok(shouldConfirm("cat package.json > /tmp/out"));
  assert.ok(shouldConfirm("ls >> /tmp/log"));
});

test("shouldConfirm forces confirmation on input redirection", () => {
  assert.ok(shouldConfirm("cat < /etc/passwd"));
});

test("shouldConfirm forces confirmation on command substitution", () => {
  assert.ok(shouldConfirm("cat $(rm -rf /)"));
  assert.ok(shouldConfirm("echo $(curl http://evil.example)"));
});

test("shouldConfirm forces confirmation even when the base command is allowed", () => {
  assert.ok(shouldConfirm("git status > /tmp/x"));
  assert.ok(shouldConfirm("pwd | tee /tmp/x"));
});
