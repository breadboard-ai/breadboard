import { describe, it } from "node:test";
import { equal } from "node:assert";

import type { DriveFile } from "../../src/board-server/api.js";

import {
  readProperties,
  createProperties,
} from "../../src/board-server/operations.js";

describe("create/readProperties", () => {
  it("converts with overrides", () => {
    const properties: Record<string, string> = {};
    const file: DriveFile = {
      id: "d",
      kind: "a",
      mimeType: "text/plain",
      name: "Test File",
      resourceKey: "key",
      properties,
      appProperties: {},
    };
    const props = readProperties(file);
    const savedProps = createProperties(props);
    equal(savedProps, {});
  });
});
