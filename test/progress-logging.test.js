import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isWithinRoot, makeProgressLogging } from "../src/progress-logging.js";
import { Logger } from "../src/logger.js";

describe("isWithinRoot", () => {
  const cwd = process.cwd();

  test("returns true for a file in cwd", () => {
    assert.ok(isWithinRoot("./foo.txt", cwd));
  });

  test("returns true for a nested path in cwd", () => {
    assert.ok(isWithinRoot("./src/tools/foo.js", cwd));
  });

  test("returns true for an absolute path within cwd", () => {
    assert.ok(isWithinRoot(`${cwd}/src/index.js`, cwd));
  });

  test("returns false for a parent directory escape", () => {
    assert.ok(!isWithinRoot("../etc/passwd", cwd));
  });

  test("returns false for a sibling directory", () => {
    assert.ok(!isWithinRoot(`${cwd}/../sibling/file.txt`, cwd));
  });

  test("returns false for an absolute path outside cwd", () => {
    assert.ok(!isWithinRoot("/etc/passwd", cwd));
  });

  test("returns true for the cwd itself", () => {
    assert.ok(isWithinRoot(".", cwd));
  });
});

describe("makeProgressLogging with allowLocal", () => {
  test("skips confirm for writes within cwd", async () => {
    let confirmCalled = false;
    const confirm = async () => {
      confirmCalled = true;
    };

    const { onbeforetool } = makeProgressLogging({
      confirm,
      allowLocal: true,
      logger: new Logger(),
    });

    await onbeforetool("write_file", {
      path: "./testfile.txt",
      content: "hello",
    });

    assert.ok(!confirmCalled, "confirm should not be called for local writes");
  });

  test("skips confirm for edits within cwd", async () => {
    let confirmCalled = false;
    const confirm = async () => {
      confirmCalled = true;
    };

    const { onbeforetool } = makeProgressLogging({
      confirm,
      allowLocal: true,
      logger: new Logger(),
    });

    await onbeforetool("edit_file", {
      path: "./src/index.js",
      old_text: "foo",
      new_text: "bar",
    });

    assert.ok(!confirmCalled, "confirm should not be called for local edits");
  });

  test("calls confirm for writes outside cwd", async () => {
    let confirmCalled = false;
    const confirm = async () => {
      confirmCalled = true;
    };

    const { onbeforetool } = makeProgressLogging({
      confirm,
      allowLocal: true,
      logger: new Logger(),
    });

    await onbeforetool("write_file", {
      path: "/etc/somefile.txt",
      content: "hello",
    });

    assert.ok(confirmCalled, "confirm should be called for writes outside cwd");
  });

  test("calls confirm for edits outside cwd", async () => {
    let confirmCalled = false;
    const confirm = async () => {
      confirmCalled = true;
    };

    const { onbeforetool } = makeProgressLogging({
      confirm,
      allowLocal: true,
      logger: new Logger(),
    });

    await onbeforetool("edit_file", {
      path: "/etc/somefile.txt",
      old_text: "foo",
      new_text: "bar",
    });

    assert.ok(confirmCalled, "confirm should be called for edits outside cwd");
  });

  test("calls confirm for all writes when allowLocal is false", async () => {
    let confirmCalled = 0;
    const confirm = async () => {
      confirmCalled++;
    };

    const { onbeforetool } = makeProgressLogging({
      confirm,
      allowLocal: false,
      logger: new Logger(),
    });

    await onbeforetool("write_file", {
      path: "./testfile.txt",
      content: "hello",
    });

    assert.ok(
      confirmCalled === 1,
      "confirm should be called even for local writes when allowLocal is false",
    );
  });
});
