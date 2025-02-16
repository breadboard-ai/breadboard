/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { relativePath };

/**
 * Resolves two URLs into a relative path from one URL to another.
 */
function relativePath(from: URL, to: URL): string {
  if (from.protocol !== to.protocol) return to.href;
  if (from.host !== to.host) return to.href;

  const fromSegments = from.pathname.split("/").filter(Boolean);
  const toSegments = to.pathname.split("/").filter(Boolean);

  const isFromDir = from.pathname.endsWith("/");
  const isToDir = to.pathname.endsWith("/");

  const commonLength = [...fromSegments.entries()].filter(
    ([i, segment]) => segment === toSegments[i]
  ).length;

  const upLevels = fromSegments.length - commonLength;

  const relativePath = [
    ...Array(upLevels).fill(".."),
    ...toSegments.slice(commonLength),
  ];

  if (relativePath.length === 0) {
    return isFromDir ? "./" : `./${toSegments.at(-1)}`;
  }

  if (!isFromDir) {
    relativePath.shift();
  }

  let result = relativePath.join("/");

  if (!result.startsWith(".")) {
    result = `./${result}`;
  }

  if (isToDir) {
    result = `${result}/`;
  }

  if (to.search) {
    result += to.search;
  }

  if (to.hash) {
    result += to.hash;
  }

  return result;
}
