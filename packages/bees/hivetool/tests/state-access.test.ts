/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StateAccess } from "../src/data/state-access.js";

// Mock FileSystemDirectoryHandle for testing discovery.
function createMockDirectory(
  name: string,
  children: Record<string, unknown> = {}
): unknown {
  return {
    name,
    kind: "directory",
    getDirectoryHandle: async (subName: string) => {
      const child = children[subName] as { kind: string } | undefined;
      if (child && child.kind === "directory") return child;
      throw new Error(`Directory ${subName} not found`);
    },
    getFileHandle: async (fileName: string) => {
      const child = children[fileName] as { kind: string } | undefined;
      if (child && child.kind === "file") return child;
      throw new Error(`File ${fileName} not found`);
    },
    entries: async function* () {
      for (const [key, value] of Object.entries(children)) {
        yield [key, value];
      }
    }
  };
}

function createMockFile(name: string): unknown {
  return {
    name,
    kind: "file"
  };
}

describe("StateAccess - Directory Detection & Case Discovery", () => {
  it("detects a standalone Single-Hive directory", async () => {
    const access = new StateAccess();

    // Create a standalone hive: has config/SYSTEM.yaml at root.
    const configDir = createMockDirectory("config", {
      "SYSTEM.yaml": createMockFile("SYSTEM.yaml")
    });
    const rootHandle = createMockDirectory("my-standalone-hive", {
      config: configDir
    });

    // Call internal detection helper directly.
    await access._detectAndLoadCases(rootHandle as FileSystemDirectoryHandle);

    assert.equal(access.isMultiHive.get(), false);
    assert.deepEqual(access.cases.get(), []);
    assert.equal(access.activeCaseId.get(), null);
    assert.equal(access.handle, rootHandle as FileSystemDirectoryHandle);
  });

  it("detects a Multi-Hive parent and programmatically discovers nested sub-hives", async () => {
    const access = new StateAccess();

    // Create case-1/hive with config/SYSTEM.yaml.
    const case1Config = createMockDirectory("config", {
      "SYSTEM.yaml": createMockFile("SYSTEM.yaml")
    });
    const case1Hive = createMockDirectory("hive", {
      config: case1Config
    });
    const case1 = createMockDirectory("case-1", {
      hive: case1Hive
    });

    // Create case-2/hive with config/SYSTEM.yaml.
    const case2Config = createMockDirectory("config", {
      "SYSTEM.yaml": createMockFile("SYSTEM.yaml")
    });
    const case2Hive = createMockDirectory("hive", {
      config: case2Config
    });
    const case2 = createMockDirectory("case-2", {
      hive: case2Hive
    });

    // Root results directory containing both cases.
    const resultsDir = createMockDirectory("results", {
      "case-1": case1,
      "case-2": case2
    });

    // Run detection.
    await access._detectAndLoadCases(resultsDir as FileSystemDirectoryHandle);

    assert.equal(access.isMultiHive.get(), true);
    
    const cases = access.cases.get();
    assert.equal(cases.length, 2);
    assert.equal(cases[0].id, "case-1/hive");
    assert.equal(cases[1].id, "case-2/hive");

    // Should auto-select the first discovered case.
    assert.equal(access.activeCaseId.get(), "case-1/hive");
    assert.equal(access.handle, case1Hive as FileSystemDirectoryHandle);

    // Switch to case-2 programmatically.
    await access.switchToCase("case-2/hive");
    assert.equal(access.activeCaseId.get(), "case-2/hive");
    assert.equal(access.handle, case2Hive as FileSystemDirectoryHandle);
  });
});
