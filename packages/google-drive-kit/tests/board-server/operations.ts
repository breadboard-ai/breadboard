/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, it } from "node:test";
import { deepEqual } from "node:assert";

import { createProperties } from "../../src/board-server/operations.js";
import { readProperties } from "../../src/board-server/utils.js";
import type { NarrowedDriveFile } from "../../src/google-drive-client.js";

describe("create/readProperties", () => {
  let properties: Record<string, string>;
  let file: NarrowedDriveFile<["properties", "appProperties"]> &
    gapi.client.drive.File;

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
