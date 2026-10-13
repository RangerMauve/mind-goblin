import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  check,
  checkLine,
  hasDangerousPatterns,
  hasFindAction,
  hasQuotedCommandSubstitution,
  hasRedirectionOrSubstitution,
  isAllowed,
  splitLines,
  stripQuotedArgs,
} from "../src/tools/shell_command.js";

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
  assert.ok(isAllowed("npm view @scope/pkg version"));
  assert.ok(isAllowed("jq .name package.json"));
});

test("hasDangerousPatterns detects joiners and substitution", () => {
  assert.ok(hasDangerousPatterns("ls && rm -rf /"));
  assert.ok(hasDangerousPatterns("ls | rm -rf /"));
  assert.ok(hasDangerousPatterns("echo ${HOME}"));
  assert.equal(hasDangerousPatterns("ls -la"), false);
});

test("check auto-allows the repro command", () => {
  assert.equal(check("ls && cat package.json | head -30"), false);
});

test("isAllowed allows printf", () => {
  assert.ok(isAllowed("printf '%s\\n' hello"));
});

test("check auto-allows printf", () => {
  assert.equal(check("printf 'hello\\n'"), false);
});

test("check auto-allows simple allowed commands", () => {
  assert.equal(check("ls"), false);
  assert.equal(check("pwd"), false);
  assert.equal(check("cat package.json"), false);
});

test("check allows allowed compound commands", () => {
  assert.equal(check("ls && cat package.json"), false);
  assert.equal(check("git status && git diff"), false);
  assert.equal(check("ls | head -5"), false);
});

test("check allows stripped stderr redirection", () => {
  assert.equal(check("ls 2>&1"), false);
  assert.equal(check("ls 2>/dev/null"), false);
});

test("check rejects unknown commands", () => {
  assert.ok(check("rm -rf /"));
  assert.ok(check("curl http://evil.example"));
});

test("check rejects compounds with a disallowed part", () => {
  assert.ok(check("ls && rm -rf /"));
  assert.ok(check("rm -rf / && ls"));
  assert.ok(check("ls | rm -rf /"));
  assert.ok(check("ls || rm -rf /"));
});

test("check rejects multi-line commands with a disallowed part", () => {
  assert.ok(check("ls\nrm -rf /"));
});

test("check allows multi-line commands where every line is allowed", () => {
  assert.equal(check("ls\npwd\necho hello"), false);
});

test("check allows multi-line with blank lines between commands", () => {
  assert.equal(check("ls\n\npwd"), false);
});

test("check allows multi-line with full-line comments", () => {
  assert.equal(check("# list files\nls\n# show directory\npwd"), false);
});

test("check allows multi-line with compound expressions on one line", () => {
  assert.equal(check("ls && pwd\necho done"), false);
});

test("check rejects multi-line with a disallowed line", () => {
  assert.ok(check("ls\ncurl http://evil.example"));
});

test("check allows backslash continuation", () => {
  assert.equal(check("ls \\\n  -la"), false);
});

test("check allows backslash continuation across multiple lines", () => {
  assert.equal(check("echo \\\n  hello \\\n  world"), false);
});

test("check rejects backslash continuation to disallowed command", () => {
  assert.ok(check("rm \\\n  -rf /"));
});

test("check allows CRLF line endings", () => {
  assert.equal(check("ls\r\npwd"), false);
});

test("check allows empty string", () => {
  assert.equal(check(""), false);
});

test("check allows only newlines and comments", () => {
  assert.equal(check("\n\n# just a comment\n"), false);
});

test("check rejects empty subcommands from leading joiners", () => {
  assert.ok(check("&& ls"));
});

test("hasRedirectionOrSubstitution detects > < and $(", () => {
  assert.ok(hasRedirectionOrSubstitution("cat f > /tmp/x"));
  assert.ok(hasRedirectionOrSubstitution("cat f >> /tmp/x"));
  assert.ok(hasRedirectionOrSubstitution("cat < /etc/passwd"));
  assert.ok(hasRedirectionOrSubstitution("cat $(rm -rf /)"));
  assert.equal(hasRedirectionOrSubstitution("ls -la"), false);
});

test("check forces confirmation on output redirection", () => {
  assert.ok(check("cat package.json > /tmp/out"));
  assert.ok(check("ls >> /tmp/log"));
});

test("check forces confirmation on input redirection", () => {
  assert.ok(check("cat < /etc/passwd"));
});

test("check forces confirmation on command substitution", () => {
  assert.ok(check("cat $(rm -rf /)"));
  assert.ok(check("echo $(curl http://evil.example)"));
});

test("check forces confirmation even when the base command is allowed", () => {
  assert.ok(check("git status > /tmp/x"));
  assert.ok(check("pwd | tee /tmp/x"));
});

test("hasDangerousPatterns detects the semicolon joiner", () => {
  assert.ok(hasDangerousPatterns("ls -la; rm -rf ~"));
  assert.equal(hasDangerousPatterns("ls -la"), false);
});

test("check rejects semicolon-joined commands with a disallowed part", () => {
  assert.ok(check("ls -la; rm -rf ~"));
  assert.ok(check("ls;rm"));
  assert.ok(check("ls 2>/dev/null; rm -rf ~"));
});

test("check allows semicolon-joined commands when every part is allowed", () => {
  assert.equal(check("ls; cat package.json"), false);
  assert.equal(check("pwd; echo hi"), false);
});

test("hasRedirectionOrSubstitution detects backtick substitution", () => {
  assert.ok(hasRedirectionOrSubstitution("ls `id`"));
  assert.equal(hasRedirectionOrSubstitution("ls -la"), false);
});

test("check rejects backtick command substitution", () => {
  assert.ok(check("ls `id`"));
  assert.ok(check("cat `rm -rf /`"));
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

test("check rejects find with action expressions", () => {
  assert.ok(check("find . -delete"));
  assert.ok(check("find . -exec rm {} +"));
  assert.ok(check("ls && find . -delete"));
  assert.ok(check("ls; find . -delete"));
});

test("check allows read-only find", () => {
  assert.equal(check("find . -name '*.js'"), false);
  assert.equal(check("find . -name x | head"), false);
});

test("check rejects carriage-return-separated commands", () => {
  assert.ok(check("ls\rrm -rf /"));
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

test("check allows metacharacters inside quoted strings", () => {
  // Semicolon and > inside quotes are literal data, not operators.
  assert.equal(check('grep "a;b" file'), false);
  assert.equal(check('echo "a > b"'), false);
  assert.equal(check('find . -name "*.txt"'), false);
  assert.equal(check('git diff "file with space"'), false);
});

test("check allows $() inside single quotes (literal)", () => {
  // Single quotes are fully literal, so no execution happens.
  assert.equal(check("echo '$(rm -rf /)'"), false);
  assert.equal(check("find . -name '-delete'"), false);
});

test("check forces confirmation on $() inside double quotes", () => {
  assert.ok(check('echo "$(rm -rf /)"'));
  assert.ok(check('cat "$(curl http://evil.example)"'));
});

test("check forces confirmation on backticks inside double quotes", () => {
  assert.ok(check('echo "`id`"'));
  assert.ok(check('cat "`rm -rf /`"'));
});

test("check forces confirmation on escaped quotes that stay literal", () => {
  // "a\"b" is the literal a"b with no substitution.
  assert.equal(check('echo "a\\"b"'), false);
});

test("check forces confirmation on unterminated quotes", () => {
  assert.ok(check("echo 'unterminated"));
  assert.ok(check('echo "unterminated'));
});

test("isAllowed allows cd to current working directory", () => {
  assert.ok(isAllowed(`cd ${process.cwd()}`));
});

test("isAllowed rejects cd to other paths", () => {
  assert.equal(isAllowed("cd /somewhere/else"), false);
});

test("check allows cd to cwd combined with another allowed command", () => {
  assert.equal(check(`cd ${process.cwd()} && git diff`), false);
  assert.equal(check(`cd ${process.cwd()} && ls`), false);
});

test("check rejects cd to non-cwd path in compound", () => {
  assert.ok(check("cd /etc && ls"));
  assert.ok(check("ls && cd /etc"));
});

// --- splitLines ---

test("splitLines: single line unchanged", () => {
  assert.deepEqual(splitLines("ls -la"), ["ls -la"]);
});

test("splitLines: splits on newlines", () => {
  assert.deepEqual(splitLines("ls\ncat foo.txt"), ["ls", "cat foo.txt"]);
});

test("splitLines: splits on CRLF", () => {
  assert.deepEqual(splitLines("ls\r\npwd"), ["ls", "pwd"]);
});

test("splitLines: skips blank lines", () => {
  assert.deepEqual(splitLines("ls\n\npwd\n"), ["ls", "pwd"]);
});

test("splitLines: skips full-line comments", () => {
  assert.deepEqual(splitLines("# comment\nls\n  # indented\npwd"), [
    "ls",
    "pwd",
  ]);
});

test("splitLines: merges backslash continuations", () => {
  assert.deepEqual(splitLines("ls \\\n  -la"), ["ls    -la"]);
});

test("splitLines: multiple backslash continuations", () => {
  assert.deepEqual(splitLines("echo \\\n  a \\\n  b"), ["echo    a    b"]);
});

test("splitLines: dangling backslash at end", () => {
  assert.deepEqual(splitLines("ls \\"), ["ls  "]);
});

test("splitLines: comment inside continuation is part of the line", () => {
  // In shell, a backslash continuation makes the next line a literal
  // continuation — # is just an argument character, not a comment.
  assert.deepEqual(splitLines("echo \\\n# note\n  hi"), [
    "echo  # note",
    "  hi",
  ]);
});

// --- checkLine ---

test("checkLine: allowed command", () => {
  assert.equal(checkLine("ls -la"), false);
});

test("checkLine: disallowed command", () => {
  assert.equal(checkLine("rm -rf /"), true);
});

test("checkLine: compound with all allowed", () => {
  assert.equal(checkLine("ls && pwd"), false);
});

test("checkLine: compound with disallowed part", () => {
  assert.equal(checkLine("ls && rm foo"), true);
});

test("checkLine: unterminated quote is not safe", () => {
  assert.equal(checkLine("echo 'unterminated"), true);
});

test("checkLine: redirection is not safe", () => {
  assert.equal(checkLine("ls > file"), true);
});

test("checkLine: find with -delete is not safe", () => {
  assert.equal(checkLine("find . -name x -delete"), true);
});

test("checkLine: find without actions is safe", () => {
  assert.equal(checkLine("find . -name *.js"), false);
});
