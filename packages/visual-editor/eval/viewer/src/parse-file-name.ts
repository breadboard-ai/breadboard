/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { parseFileName, buildFileHierarchy };

export type ParsedFileMedata = {
  path: string;
  type: string;
  name: string;
  date: Date;
};

export type GroupedByName = {
  name: string;
  files: ParsedFileMedata[];
};

export type GroupedByType = {
  type: string;
  items: GroupedByName[];
};

function parseFileName(fullPath: string): ParsedFileMedata {
  const fileName = fullPath.split("/").at(-1)!;
  const regex =
    /^([^-]+)-(.+)-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.log\.json$/;

  const match = fileName.match(regex);

  if (!match) {
    throw new Error(`Invalid file format: ${fileName}`);
  }

  const [, type, rawName, dateString] = match;

  const humanName = rawName
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
  const [year, month, day, hour, minute, second] = dateString
    .split("-")
    .map(Number);
  const dateObj = new Date(year, month - 1, day, hour, minute, second);

  return {
    path: fullPath,
    type,
    name: humanName,
    date: dateObj,
  };
}

function buildFileHierarchy(files: ParsedFileMedata[]): GroupedByType[] {
  const lookup = new Map<string, Map<string, ParsedFileMedata[]>>();

  for (const file of files) {
    if (!lookup.has(file.type)) {
      lookup.set(file.type, new Map());
    }

    const typeGroup = lookup.get(file.type)!;

    if (!typeGroup.has(file.name)) {
      typeGroup.set(file.name, []);
    }

    typeGroup.get(file.name)!.push(file);
  }

  const result: GroupedByType[] = Array.from(lookup.entries()).map(
    ([type, nameMap]) => {
      const items: GroupedByName[] = Array.from(nameMap.entries()).map(
        ([name, fileList]) => {
          const sortedFiles = fileList.sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          return {
            name,
            files: sortedFiles,
          };
        }
      );

      items.sort((a, b) => a.name.localeCompare(b.name));

      return {
        type,
        items,
      };
    }
  );

  result.sort((a, b) => a.type.localeCompare(b.type));

  return result;
}
