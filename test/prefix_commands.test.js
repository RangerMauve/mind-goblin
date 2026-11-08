import { test } from "node:test";
import { strict as assert } from "node:assert";
import { check, isAllowed, unwrap } from "../src/tools/shell_command.js";

// --- unwrap unit tests ---

test("unwrap: non-prefix commands are returned unchanged", () => {
  assert.equal(unwrap("ls -la"), "ls -la");
  assert.equal(unwrap("grep foo bar"), "grep foo bar");
  assert.equal(unwrap("find . -name x"), "find . -name x");
});

test("unwrap: timeout strips its duration and flags", () => {
  assert.equal(unwrap("timeout 5 grep pattern"), "grep pattern");
  assert.equal(unwrap("timeout 10s cat file"), "cat file");
  assert.equal(unwrap("timeout --signal=TERM 3 ls"), "ls");
  assert.equal(unwrap("timeout 2m find . -name x"), "find . -name x");
});

test("unwrap: timeout strips a decimal duration", () => {
  assert.equal(unwrap("timeout 2.5 grep foo"), "grep foo");
});

test("unwrap: timeout with no inner command returns null", () => {
  assert.equal(unwrap("timeout 5"), null);
  assert.equal(unwrap("timeout"), null);
});

test("unwrap: time, nice, nohup, xargs strip their own flags", () => {
  assert.equal(unwrap("time -p ls"), "ls");
  assert.equal(unwrap("nice -n 10 ls"), "ls");
  assert.equal(unwrap("nice -5 cat file"), "cat file");
  assert.equal(unwrap("nice -- ls"), "ls");
  assert.equal(unwrap("nohup grep foo"), "grep foo");
  assert.equal(unwrap("xargs -n1 -P4 sort"), "sort");
});

test("unwrap: nested prefix commands collapse to the innermost", () => {
  assert.equal(unwrap("timeout 10 nice grep foo"), "grep foo");
  assert.equal(unwrap("nohup timeout 5 ls"), "ls");
});

// --- check() integration tests ---

test("check: auto-allows prefix commands with an allowed inner", () => {
  assert.equal(check("timeout 10 grep pattern file"), false);
  assert.equal(check("timeout 5s cat package.json"), false);
  assert.equal(check("time grep foo"), false);
  assert.equal(check("nice -n 5 ls"), false);
  assert.equal(check("nohup grep foo"), false);
  assert.equal(check("xargs -n1 sort"), false);
});

test("check: rejects prefix commands with a disallowed inner", () => {
  assert.ok(check("timeout 5 rm -rf /"));
  assert.ok(check("timeout 1 curl http://evil"));
  assert.ok(check("time rm -rf /"));
  assert.ok(check("nice rm"));
  assert.ok(check("nohup rm -rf /"));
  assert.ok(check("xargs -n1 rm -rf /"));
});

test("check: rejects a prefix command that wraps nothing", () => {
  assert.ok(check("timeout 5"));
  assert.ok(check("timeout"));
});

test("check: closes the find-action bypass through prefix commands", () => {
  // A wrapper no longer masks a destructive find action.
  assert.ok(check("timeout 10 find . -delete"));
  assert.ok(check("time find . -exec rm {} +"));
  assert.ok(check("nice find . -delete"));
  assert.ok(check("nohup find . -exec rm {} +"));
});

test("check: still allows a read-only find through a prefix command", () => {
  assert.equal(check("timeout 10 find . -name '*.js'"), false);
  assert.equal(check("nice find . -name x | head"), false);
});

test("check: piped xargs with an allowed inner", () => {
  assert.equal(
    check('find . -name "*.java" | xargs grep -l "foo" | head -5'),
    false,
  );
});

test("check: piped xargs with a disallowed inner", () => {
  assert.ok(check("find . -name '*.java' | xargs rm -f"));
  assert.ok(check("ls | xargs curl http://evil"));
});

test("check: original repro command passes", () => {
  const cmd =
    'find java/com/wakeup -path "*glasses*" -name "*.java" | xargs grep -l "GATT" 2>/dev/null | head -15';
  assert.equal(check(cmd), false);
});

// --- isAllowed no longer treats wrapper names as allowlisted ---

test("isAllowed: wrapper commands are not in the plain allowlist", () => {
  // Wrappers are handled by unwrap(), not by the allowlist.
  assert.equal(isAllowed("timeout 5 ls"), false);
  assert.equal(isAllowed("xargs grep foo"), false);
  assert.equal(isAllowed("time ls"), false);
  // But the unwrapped inner command is allowlisted.
  assert.ok(isAllowed("ls"));
  assert.ok(isAllowed("grep foo"));
});
