import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { conf, resolveModel } from "../src/utils.js";
import { makeGoblin } from "./helpers.js";

describe("resolveModel", () => {
  it("returns a config with model, server, and api_key for default", () => {
    const config = resolveModel("default");
    assert.ok(config.model);
    assert.ok(config.server);
    assert.ok("api_key" in config);
  });

  it("default preset matches top-level config values", () => {
    const config = resolveModel("default");
    assert.equal(config.model, conf.model);
    assert.equal(config.server, conf.server);
    assert.equal(config.api_key, conf.api_key);
  });

  it("throws for unknown model name", () => {
    assert.throws(
      () => resolveModel("nonexistent"),
      /Unknown model "nonexistent"/,
    );
  });

  it("error message lists available models", () => {
    try {
      resolveModel("nope");
      assert.fail("should have thrown");
    } catch (e) {
      assert.match(e.message, /Available models:/);
      assert.match(e.message, /default/);
    }
  });

  it("merges preset overrides on top of base config", () => {
    const models = conf.models ?? (conf.models = {});
    const original = models.test_preset;
    models.test_preset = { model: "test-model", temperature: 0.1 };
    try {
      const config = resolveModel("test_preset");
      assert.equal(config.model, "test-model");
      assert.equal(config.temperature, 0.1);
      // Non-overridden keys come from base config
      assert.equal(config.server, conf.server);
    } finally {
      if (original === undefined) {
        delete models.test_preset;
      } else {
        models.test_preset = original;
      }
    }
  });
});

describe("models.default auto-population", () => {
  it("conf.models.default exists", () => {
    assert.ok(conf.models);
    assert.ok(conf.models?.default);
  });

  it("models.default has top-level params", () => {
    assert.equal(conf.models?.default?.model, conf.model);
    assert.equal(conf.models?.default?.server, conf.server);
  });

  it("models.default does not contain models key", () => {
    assert.equal(conf.models?.default?.models, undefined);
  });
});

describe("Goblin config property", () => {
  it("defaults to conf", async () => {
    const goblin = await makeGoblin();
    assert.equal(goblin.config, conf);
  });

  it("can be set explicitly", async () => {
    const custom = { ...conf, model: "custom-model" };
    const goblin = await makeGoblin({ config: custom });
    assert.equal(goblin.config, custom);
    assert.equal(goblin.config.model, "custom-model");
  });

  it("fork inherits config", async () => {
    const custom = { ...conf, model: "fork-model" };
    const parent = await makeGoblin({ config: custom });
    const child = parent.fork({});
    assert.equal(child.config, custom);
  });

  it("fork can override config", async () => {
    const parentConfig = { ...conf, model: "parent" };
    const childConfig = { ...conf, model: "child" };
    const parent = await makeGoblin({ config: parentConfig });
    const child = parent.fork({ config: childConfig });
    assert.equal(child.config, childConfig);
    assert.equal(parent.config, parentConfig);
  });
});
