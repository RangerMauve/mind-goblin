import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  shouldConfirm,
  isAllowed,
  hasDangerousPatterns,
  hasRedirectionOrSubstitution,
  hasFindAction,
  stripQuotedArgs,
  hasQuotedCommandSubstitution,
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

test("hasDangerousPatterns detects the semicolon joiner", () => {
  assert.ok(hasDangerousPatterns("ls -la; rm -rf ~"));
  assert.equal(hasDangerousPatterns("ls -la"), false);
});

test("shouldConfirm rejects semicolon-joined commands with a disallowed part", () => {
  assert.ok(shouldConfirm("ls -la; rm -rf ~"));
  assert.ok(shouldConfirm("ls;rm"));
  assert.ok(shouldConfirm("ls 2>/dev/null; rm -rf ~"));
});

test("shouldConfirm allows semicolon-joined commands when every part is allowed", () => {
  assert.equal(shouldConfirm("ls; cat package.json"), false);
  assert.equal(shouldConfirm("pwd; echo hi"), false);
});

test("hasRedirectionOrSubstitution detects backtick substitution", () => {
  assert.ok(hasRedirectionOrSubstitution("ls `id`"));
  assert.equal(hasRedirectionOrSubstitution("ls -la"), false);
});

test("shouldConfirm rejects backtick command substitution", () => {
  assert.ok(shouldConfirm("ls `id`"));
  assert.ok(shouldConfirm("cat `rm -rf /`"));
});

test("hasFindAction detects destructive find expressions", () => {
  assert.ok(hasFindAction("find . -delete"));
  assert.ok(hasFindAction("find -delete"));
  assert.ok(hasFindAction("find . -exec rm {} +"));
  assert.ok(hasFindAction("find . -execdir rm {} +"));
  assert.ok(hasFindAction("find . -ok rm {} \\;"));
  assert.equal(hasFindAction("find . -name '*.js'"), false);
  assert.equal(hasFindAction("ls -la"), false);
});

test("shouldConfirm rejects find with action expressions", () => {
  assert.ok(shouldConfirm("find . -delete"));
  assert.ok(shouldConfirm("find . -exec rm {} +"));
  assert.ok(shouldConfirm("ls && find . -delete"));
  assert.ok(shouldConfirm("ls; find . -delete"));
});

test("shouldConfirm allows read-only find", () => {
  assert.equal(shouldConfirm("find . -name '*.js'"), false);
  assert.equal(shouldConfirm("find . -name x | head"), false);
});

test("shouldConfirm rejects carriage-return-separated commands", () => {
  assert.ok(shouldConfirm("ls\rrm -rf /"));
});

test("stripQuotedArgs removes single- and double-quoted spans", () => {
  const r = stripQuotedArgs("find . -name \"*.js\" && echo 'hi; there'");
  assert.ok(r.stripped !== null);
  assert.deepEqual(
    r.stripped.replace(/\s+/g, " ").trim(),
    "find . -name && echo",
  );
  assert.deepEqual(r.doubleQuoted, ["*.js"]);
});

test("stripQuotedArgs keeps escaped characters in double quotes", () => {
  const r = stripQuotedArgs('echo "a\\"b"');
  assert.ok(r.stripped !== null);
  assert.deepEqual(r.doubleQuoted, ['a"b']);
});

test("stripQuotedArgs flags unterminated quotes", () => {
  assert.equal(stripQuotedArgs("echo 'unterminated").stripped, null);
  assert.equal(stripQuotedArgs('echo "unterminated').stripped, null);
});

test("hasQuotedCommandSubstitution detects $() and backticks", () => {
  assert.ok(hasQuotedCommandSubstitution("$(rm -rf /)"));
  assert.ok(hasQuotedCommandSubstitution("`id`"));
  assert.equal(hasQuotedCommandSubstitution("a;b > c"), false);
});

test("shouldConfirm allows metacharacters inside quoted strings", () => {
  // Semicolon and > inside quotes are literal data, not operators.
  assert.equal(shouldConfirm('grep "a;b" file'), false);
  assert.equal(shouldConfirm('echo "a > b"'), false);
  assert.equal(shouldConfirm('find . -name "*.txt"'), false);
  assert.equal(shouldConfirm('git diff "file with space"'), false);
});

test("shouldConfirm allows $() inside single quotes (literal)", () => {
  // Single quotes are fully literal, so no execution happens.
  assert.equal(shouldConfirm("echo '$(rm -rf /)'"), false);
  assert.equal(shouldConfirm("find . -name '-delete'"), false);
});

test("shouldConfirm forces confirmation on $() inside double quotes", () => {
  assert.ok(shouldConfirm('echo "$(rm -rf /)"'));
  assert.ok(shouldConfirm('cat "$(curl http://evil.example)"'));
});

test("shouldConfirm forces confirmation on backticks inside double quotes", () => {
  assert.ok(shouldConfirm('echo "`id`"'));
  assert.ok(shouldConfirm('cat "`rm -rf /`"'));
});

test("shouldConfirm forces confirmation on escaped quotes that stay literal", () => {
  // "a\"b" is the literal a"b with no substitution.
  assert.equal(shouldConfirm('echo "a\\"b"'), false);
});

test("shouldConfirm forces confirmation on unterminated quotes", () => {
  assert.ok(shouldConfirm("echo 'unterminated"));
  assert.ok(shouldConfirm('echo "unterminated'));
});
