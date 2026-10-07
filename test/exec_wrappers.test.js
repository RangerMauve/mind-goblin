import { test } from "node:test";
import { strict as assert } from "node:assert";
import { check, isAllowed, isWrapperSafe } from "../src/tools/shell_command.js";

// --- isWrapperSafe unit tests ---

test("isWrapperSafe returns true for non-wrapper commands", () => {
  assert.equal(isWrapperSafe("ls -la"), true);
  assert.equal(isWrapperSafe("grep foo bar"), true);
});

test("isWrapperSafe: xargs with allowed inner command", () => {
  assert.equal(isWrapperSafe("xargs grep -l foo"), true);
  assert.equal(isWrapperSafe("xargs -0 grep pattern"), true);
  assert.equal(isWrapperSafe("xargs -n1 -P4 sort"), true);
});

test("isWrapperSafe: xargs with disallowed inner command", () => {
  assert.equal(isWrapperSafe("xargs rm -rf /"), false);
  assert.equal(isWrapperSafe("xargs -0 curl http://evil"), false);
});

test("isWrapperSafe: xargs with no inner command", () => {
  assert.equal(isWrapperSafe("xargs"), false);
  assert.equal(isWrapperSafe("xargs -0"), false);
});

test("isWrapperSafe: timeout with allowed inner command", () => {
  assert.equal(isWrapperSafe("timeout 5 grep pattern"), true);
  assert.equal(isWrapperSafe("timeout 10s cat file"), true);
  assert.equal(isWrapperSafe("timeout --signal=TERM 3 ls"), true);
  assert.equal(isWrapperSafe("timeout 2m find . -name x"), true);
});

test("isWrapperSafe: timeout with disallowed inner command", () => {
  assert.equal(isWrapperSafe("timeout 5 rm -rf /"), false);
  assert.equal(isWrapperSafe("timeout 1 curl http://evil"), false);
});

test("isWrapperSafe: timeout with no inner command", () => {
  assert.equal(isWrapperSafe("timeout 5"), false);
  assert.equal(isWrapperSafe("timeout"), false);
});

test("isWrapperSafe: time with allowed inner command", () => {
  assert.equal(isWrapperSafe("time grep foo"), true);
  assert.equal(isWrapperSafe("time -p ls"), true);
});

test("isWrapperSafe: time with disallowed inner command", () => {
  assert.equal(isWrapperSafe("time rm -rf /"), false);
});

test("isWrapperSafe: nice with allowed inner command", () => {
  assert.equal(isWrapperSafe("nice grep foo"), true);
  assert.equal(isWrapperSafe("nice -n 10 ls"), true);
  assert.equal(isWrapperSafe("nice -5 cat file"), true);
  assert.equal(isWrapperSafe("nice -- ls"), true);
});

test("isWrapperSafe: nice with disallowed inner command", () => {
  assert.equal(isWrapperSafe("nice rm -rf /"), false);
  assert.equal(isWrapperSafe("nice -n 5 curl http://evil"), false);
});

test("isWrapperSafe: nohup with allowed inner command", () => {
  assert.equal(isWrapperSafe("nohup grep foo"), true);
});

test("isWrapperSafe: nohup with disallowed inner command", () => {
  assert.equal(isWrapperSafe("nohup rm -rf /"), false);
});

// --- check() integration tests ---

test("check: auto-allows piped xargs with allowed inner", () => {
  assert.equal(
    check('find . -name "*.java" | xargs grep -l "foo" | head -5'),
    false,
  );
});

test("check: rejects piped xargs with disallowed inner", () => {
  assert.ok(check("find . -name '*.java' | xargs rm -f"));
  assert.ok(check("ls | xargs curl http://evil"));
});

test("check: auto-allows timeout with allowed inner", () => {
  assert.equal(check("timeout 10 grep pattern file"), false);
  assert.equal(check("timeout 5s cat package.json"), false);
});

test("check: rejects timeout with disallowed inner", () => {
  assert.ok(check("timeout 5 rm -rf /"));
});

test("check: auto-allows time with allowed inner", () => {
  assert.equal(check("time grep foo"), false);
});

test("check: rejects time with disallowed inner", () => {
  assert.ok(check("time rm -rf /"));
});

test("check: auto-allows nice with allowed inner", () => {
  assert.equal(check("nice grep foo"), false);
  assert.equal(check("nice -n 5 ls"), false);
});

test("check: rejects nice with disallowed inner", () => {
  assert.ok(check("nice rm"));
});

test("check: auto-allows nohup with allowed inner", () => {
  assert.equal(check("nohup grep foo"), false);
});

test("check: rejects nohup with disallowed inner", () => {
  assert.ok(check("nohup rm -rf /"));
});

test("check: original repro command now passes", () => {
  const cmd =
    'find java/com/wakeup -path "*glasses*" -name "*.java" | xargs grep -l "GATT" 2>/dev/null | head -15';
  assert.equal(check(cmd), false);
});

// --- isAllowed still works for the wrapper names themselves ---

test("isAllowed recognizes wrapper command names", () => {
  assert.ok(isAllowed("xargs grep foo"));
  assert.ok(isAllowed("timeout 5 ls"));
  assert.ok(isAllowed("time ls"));
  assert.ok(isAllowed("nice ls"));
  assert.ok(isAllowed("nohup ls"));
});
