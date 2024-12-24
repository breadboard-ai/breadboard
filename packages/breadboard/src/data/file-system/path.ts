/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileSystemPath, Outcome } from "../types.js";
import { ok } from "./utils.js";

export { Path };

const PATH_SEPARATOR = "/";

const ROOT_DIRS: readonly { name: string; writable: boolean }[] = [
  { name: "local", writable: true },
  { name: "session", writable: true },
  { name: "run", writable: true },
  { name: "tmp", writable: true },
  { name: "env", writable: false },
  { name: "assets", writable: false },
] as const;

class Path {
  static roots = new Set(ROOT_DIRS.map((item) => item.name));
  static writableRoots = new Set(
    ROOT_DIRS.filter((item) => item.writable).map((item) => item.name)
  );

  readonly writable: boolean;

  constructor(
    public readonly root: string,
    public readonly path: string[],
    public readonly dir: boolean
  ) {
    this.writable = Path.writableRoots.has(this.root);
  }

  // This is a bit too loose, since `root` is not constrained
  // to values specified in ROOT_DIRS. But we'll just be careful and not call
  // it from anywhere other than Tree constructo.
  static createRoots(): Path[] {
    return ROOT_DIRS.map((item) => {
      return new Path(item.name, [], true);
    });
  }

  static create(path: FileSystemPath): Outcome<Path> {
    const components = path.split(PATH_SEPARATOR);
    const [leading, root, ...rest] = components;
    const isDir = rest.at(-1)?.length === 0;

    const validationResult = validate();
    if (!ok(validationResult)) {
      return validationResult;
    }
    return new Path(root, isDir ? rest.slice(0, -1) : rest, isDir);

    function validate(): Outcome<void> {
      if (leading.length !== 0)
        return {
          $error: `Invalid path "${path}": all paths must start with a slash`,
        };
      if (!Path.roots.has(root))
        return {
          $error: `Invalid path "${path}": unknown root directory`,
        };
      if (rest.length === 0)
        return {
          $error: `Invalid path "${path}": when pointing at a root directory, add a slash`,
        };
      for (const [i, fragment] of rest.entries()) {
        if (fragment.length === 0) {
          // Only last fragment can be empty (trailing slash)
          if (i !== rest.length - 1) {
            return {
              $error: `Invalid path "${path}": paths may not contain empty fragments`,
            };
          }
        }
      }
    }
  }
}
