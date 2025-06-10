import { beforeEach, describe, it } from "node:test";
import { deepEqual } from "node:assert";

import type { DriveFile } from "../../src/board-server/api.js";

import {
  readProperties,
  createProperties,
} from "../../src/board-server/operations.js";

describe("create/readProperties", () => {
  let properties: Record<string, string>;
  let file: DriveFile;

  beforeEach(() => {
    properties = {
      title: "test title",
      description: "test desc",
      tags: `["a","b"]`,
      thumbnailUrl: "abc",
    };

    file = {
      id: "d",
      kind: "a",
      mimeType: "text/plain",
      name: "Test File",
      resourceKey: "key",
      properties: {},
      appProperties: properties,
    };
  });

  it("simple convert", () => {
    const props = readProperties(file);
    deepEqual(props, {
      description: "test desc",
      thumbnailUrl: "abc",
      title: "test title",
      tags: ["a", "b"],
    });
    const savedProps = createProperties(props);
    deepEqual(savedProps, properties);
  });

  it("overrides", () => {
    file.properties = { title: "overridden" };
    const props = readProperties(file);
    deepEqual(props, {
      description: "test desc",
      thumbnailUrl: "abc",
      title: "overridden",
      tags: ["a", "b"],
    });
    const savedProps = createProperties(props);
    deepEqual(savedProps, { ...properties, title: "overridden" });
  });

  it("puts both together", () => {
    file.properties = { description: "from props" };
    file.appProperties = { title: "from app props" };
    const props = readProperties(file);
    deepEqual(props, {
      title: "from app props",
      description: "from props",
      tags: [],
      thumbnailUrl: undefined,
    });
    const savedProps = createProperties(props);
    deepEqual(savedProps, {
      title: "from app props",
      description: "from props",
      tags: "[]",
      thumbnailUrl: undefined,
    });
  });

  it("handles missing containers", () => {
    delete file.properties;
    delete file.appProperties;
    const props = readProperties(file);
    deepEqual(props, {
      title: "",
      description: "",
      tags: [],
      thumbnailUrl: undefined,
    });
  });
});
