/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type GitHashOutputs = {
  GIT_HASH: string;
};

export async function tryGetGitHash() {
  const cp = await import("node:child_process");
  return new Promise<GitHashOutputs>((resolve, reject) => {
    cp.exec(
      'git log -1 --pretty=format:"%h"',
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({ GIT_HASH: JSON.stringify(stdout) });
      }
    );
  });
}
