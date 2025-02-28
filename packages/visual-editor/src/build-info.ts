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
  return new Promise<GitHashOutputs>((resolve) => {
    cp.exec(
      'git log -1 --pretty=format:"%h"',
      { timeout: 5000 },
      (err, stdout) => {
        // Use en-CA to get yyyy-mm-dd formatted dates.
        const date = new Date().toLocaleString("en-CA", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        if (err) {
          resolve({ GIT_HASH: JSON.stringify(date) });
          return;
        }

        resolve({ GIT_HASH: JSON.stringify(`${date}; ${stdout}`) });
      }
    );
  });
}
