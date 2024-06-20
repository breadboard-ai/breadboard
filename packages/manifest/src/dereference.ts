/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from "fs";
import path from "path";
import { inspect } from "util";
import { BoardResource, DereferencedBoard } from "./types/boards";
import { isDereferencedBoard } from "./types/guards/board-resource";
import { isDereferencedManifest } from "./types/guards/manifest-resource";
import {
  isRemoteUri,
  isResourceReference,
} from "./types/guards/resource-reference";
import {
  DereferencedManifest,
  FullyDereferencedManifest,
  ManifestResource,
} from "./types/manifest";
import { Resource } from "./types/resource";
export async function dereference(
  resource: Resource
): Promise<DereferencedBoard | DereferencedManifest> {
  let data = resource;
  if (isResourceReference(data)) {
    const uri = data.url.toString();
    if (isRemoteUri(uri)) {
      data = await fetch(uri).then(async (res) => await res.json());
    } else {
      // data = await import(decodeURI(uri)).then((module) => module.default);
      data = await fs.promises
        .readFile(path.resolve(fullyDecodeURI(uri)), "utf-8")
        .then(JSON.parse);
    }
  }

  if (isDereferencedBoard(data)) {
    return data;
  } else if (isDereferencedManifest(data)) {
    return data;
  } else {
    throw makeDeepObjectError(
      "Expected a board or manifest, but got something else.",
      data
    );
  }
}

function makeDeepObjectError(message: string, data: any) {
  return new Error(
    `${message}: ${JSON.stringify({ data: inspect(data, { showHidden: true, depth: null, colors: false }) })}`
  );
}

export async function dereferenceBoard(
  resource: BoardResource
): Promise<DereferencedBoard> {
  let data = await dereference(resource);
  if (isDereferencedBoard(data)) {
    return data;
  } else {
    throw makeDeepObjectError(
      "Expected a board, but got something else.",
      data
    );
  }
}

export async function dereferenceManifest(
  resource: ManifestResource
): Promise<DereferencedManifest> {
  let data = await dereference(resource);
  if (isDereferencedManifest(data)) {
    return data;
  } else {
    throw makeDeepObjectError(
      "Expected a manifest, but got something else.",
      data
    );
  }
}

export async function fullyDereferenceManifest(
  resource: ManifestResource
): Promise<FullyDereferencedManifest> {
  let boards: DereferencedBoard[] = [];

  for await (const board of resource.boards || []) {
    boards.push(await dereferenceBoard(board));
  }

  let manifests: FullyDereferencedManifest[] = [];
  for await (const manifest of resource.manifests || []) {
    manifests.push(await fullyDereferenceManifest(manifest));
  }

  const dereferencedResource: FullyDereferencedManifest = {
    ...resource,
    boards,
    manifests,
  };
  return dereferencedResource;
}

export function isEncoded(uri: string): boolean {
  uri = uri || "";

  return uri !== decodeURIComponent(uri);
}

export function fullyDecodeURI(uri: string): string {
  while (isEncoded(uri)) {
    uri = decodeURIComponent(uri);
  }

  return uri;
}
