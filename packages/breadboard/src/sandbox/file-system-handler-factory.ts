/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capability } from "@breadboard-ai/jsandbox";
import { err, ok } from "../data/file-system/utils.js";
import {
  FileSystem,
  FileSystemQueryArguments,
  FileSystemReadArguments,
  FileSystemWriteArguments,
} from "../data/types.js";

export { FileSystemHandlerFactory };

class FileSystemHandlerFactory {
  constructor(public readonly fs?: FileSystem) {}

  query(): Capability {
    return async (inputs) => {
      if (!this.fs) {
        return err("File system capability is not available");
      }
      return this.fs.query(inputs as FileSystemQueryArguments);
    };
  }

  read(): Capability {
    return async (inputs) => {
      if (!this.fs) {
        return err("File system capability is not available");
      }
      return this.fs.read(inputs as FileSystemReadArguments);
    };
  }

  write(): Capability {
    return async (inputs) => {
      if (!this.fs) {
        return err("File system capability is not available");
      }

      const result = await this.fs.write(inputs as FileSystemWriteArguments);
      if (!ok(result)) {
        return result;
      }
      return {};
    };
  }
}
