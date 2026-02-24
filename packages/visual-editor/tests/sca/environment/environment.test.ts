/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, before, after } from "node:test";
import { createEnvironment } from "../../../src/sca/environment/environment.js";
import { EnvironmentFlags } from "../../../src/sca/environment/environment-flags.js";
import type { RuntimeConfig } from "../../../src/utils/graph-types.js";
import type { RuntimeFlags } from "@breadboard-ai/types";
import { setDOM, unsetDOM } from "../../fake-dom.js";

/**
 * Minimal RuntimeConfig fixture for createEnvironment.
 * Only the fields that createEnvironment actually reads need real values.
 */
function makeRuntimeConfig(
  overrides: Partial<RuntimeConfig> = {}
): RuntimeConfig {
  return {
    globalConfig: {
      hostOrigin: new URL("https://opal.example.com"),
      environmentName: "test",
      buildInfo: {
        packageJsonVersion: "1.2.3",
        gitCommitHash: "abc123",
      },
      googleDrive: {
        broadPermissions: [
          { id: "perm-1", type: "domain", domain: "example.com" },
        ],
      },
      flags: {
        mcp: false,
        force2DGraph: false,
        consistentUI: false,
        agentMode: false,
        opalAdk: false,
        outputTemplates: false,
        googleOne: false,
        requireConsentForGetWebpage: false,
        requireConsentForOpenWebpage: false,
        streamPlanner: false,
        streamGenWebpage: false,
        enableDrivePickerInLiteMode: false,
        enableGoogleDriveTools: false,
        enableResumeAgentRun: false,
        enableNotebookLm: false,
        enableGraphEditorAgent: false,
        textEditorRemix: false,
      },
    },
    shellHost: {
      getDriveCollectorFile: async () => ({ ok: false }),
    } as unknown as RuntimeConfig["shellHost"],
    guestConfig: {
      shareSurface: "opal",
    } as RuntimeConfig["guestConfig"],
    appName: "Test App",
    appSubName: "Test",
    ...overrides,
  } as RuntimeConfig;
}

const testFlags: RuntimeFlags = {
  mcp: true,
  force2DGraph: false,
  consistentUI: false,
  agentMode: true,
  opalAdk: false,
  outputTemplates: false,
  googleOne: false,
  requireConsentForGetWebpage: false,
  requireConsentForOpenWebpage: false,
  streamPlanner: false,
  streamGenWebpage: false,
  enableDrivePickerInLiteMode: false,
  enableGoogleDriveTools: false,
  enableResumeAgentRun: false,
  enableNotebookLm: false,
  enableGraphEditorAgent: false,
  textEditorRemix: false,
};

suite("createEnvironment", () => {
  // CLIENT_DEPLOYMENT_CONFIG reads from DOM at module scope.
  before(() => setDOM());
  after(() => unsetDOM());

  test("returns an object with all expected properties", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    const keys = Object.keys(env).sort();
    assert.deepStrictEqual(keys, [
      "buildInfo",
      "deploymentConfig",
      "domains",
      "environmentName",
      "flags",
      "googleDrive",
      "guestConfig",
      "hostOrigin",
      "isHydrated",
      "shellHost",
    ]);
  });

  test("flags is an EnvironmentFlags instance", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    assert.ok(
      env.flags instanceof EnvironmentFlags,
      "env.flags should be an EnvironmentFlags instance"
    );
  });

  test("flags reflect the provided RuntimeFlags defaults", async () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    const all = await env.flags.flags();
    assert.strictEqual(all.mcp, true, "mcp should match testFlags");
    assert.strictEqual(all.agentMode, true, "agentMode should match testFlags");
    assert.strictEqual(
      all.force2DGraph,
      false,
      "force2DGraph should match testFlags"
    );
  });

  test("hostOrigin comes from globalConfig", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.hostOrigin.href, "https://opal.example.com/");
  });

  test("environmentName comes from globalConfig", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.environmentName, "test");
  });

  test("environmentName can be undefined", () => {
    const config = makeRuntimeConfig();
    config.globalConfig.environmentName = undefined;
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.environmentName, undefined);
  });

  test("buildInfo comes from globalConfig", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.buildInfo.packageJsonVersion, "1.2.3");
    assert.strictEqual(env.buildInfo.gitCommitHash, "abc123");
  });

  test("googleDrive.broadPermissions comes from globalConfig", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.googleDrive.broadPermissions.length, 1);
    assert.strictEqual(
      (env.googleDrive.broadPermissions[0] as { domain?: string }).domain,
      "example.com"
    );
  });

  test("googleDrive.broadPermissions defaults to empty array", () => {
    const config = makeRuntimeConfig();
    // Remove broadPermissions from globalConfig
    (config.globalConfig as Record<string, unknown>).googleDrive = {};
    const env = createEnvironment(config, testFlags);
    assert.deepStrictEqual(env.googleDrive.broadPermissions, []);
  });

  test("googleDrive.apiEndpoint comes from CLIENT_DEPLOYMENT_CONFIG", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    // In test environment (no real DOM template), apiEndpoint will be undefined
    assert.strictEqual(env.googleDrive.apiEndpoint, undefined);
  });

  test("shellHost comes from config", () => {
    const mockShellHost = {
      getDriveCollectorFile: async () => ({ ok: true, id: "test-id" }),
    } as unknown as RuntimeConfig["shellHost"];
    const config = makeRuntimeConfig({ shellHost: mockShellHost });
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.shellHost, mockShellHost);
  });

  test("guestConfig comes from config", () => {
    const mockGuest = { shareSurface: "opal" } as RuntimeConfig["guestConfig"];
    const config = makeRuntimeConfig({ guestConfig: mockGuest });
    const env = createEnvironment(config, testFlags);
    assert.strictEqual(env.guestConfig, mockGuest);
  });

  test("isHydrated resolves (delegates to EnvironmentFlags)", async () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    const result = await env.isHydrated;
    assert.strictEqual(
      typeof result,
      "number",
      "isHydrated should resolve to a number"
    );
  });

  test("deploymentConfig comes from CLIENT_DEPLOYMENT_CONFIG", () => {
    const config = makeRuntimeConfig();
    const env = createEnvironment(config, testFlags);
    // In test environment, deploymentConfig will be a populated object
    // because CLIENT_DEPLOYMENT_CONFIG uses populateFlags({})
    assert.ok(env.deploymentConfig, "deploymentConfig should be defined");
    assert.ok(
      env.deploymentConfig.flags,
      "deploymentConfig.flags should be defined"
    );
  });

  test("each call produces an independent EnvironmentFlags", () => {
    const config = makeRuntimeConfig();
    const env1 = createEnvironment(config, testFlags);
    const env2 = createEnvironment(config, testFlags);
    assert.notStrictEqual(
      env1.flags,
      env2.flags,
      "each env should have its own EnvironmentFlags instance"
    );
  });

  test("flag overrides do not leak between environments", async () => {
    const config = makeRuntimeConfig();
    const env1 = createEnvironment(config, testFlags);
    const env2 = createEnvironment(config, testFlags);

    await env1.flags.override("mcp", false);

    const flags1 = await env1.flags.flags();
    const flags2 = await env2.flags.flags();
    assert.strictEqual(flags1.mcp, false, "env1 mcp should be overridden");
    assert.strictEqual(flags2.mcp, true, "env2 mcp should remain unaffected");
  });
});
