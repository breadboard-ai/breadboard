import fs from "fs";
import { inspect } from "util";
import { BreadboardManifest } from "./index";
import { BoardResource, DereferencedBoard } from "./types/boards";
import { isDereferencedBoard } from "./types/guards/board-resource";
import { isDereferencedManifest } from "./types/guards/manifest-resource";
import {
  isRemoteUri,
  isResourceReference,
} from "./types/guards/resource-reference";
import { DereferencedManifest, ManifestResource } from "./types/manifest";
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
        .readFile(fullyDecodeURI(uri), "utf-8")
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
    `${message} ${{ data: inspect(data, { showHidden: true, depth: null, colors: true }) }}`
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

export async function dereferenceAll(resource: BreadboardManifest): Promise<{
  title?: string;
  boards: DereferencedBoard[];
  manifests: DereferencedManifest[];
}> {
  let boards: DereferencedBoard[] = [];

  for await (const board of resource.boards || []) {
    boards.push(await dereferenceBoard(board));
  }

  let manifests: DereferencedManifest[] = [];
  for await (const manifest of resource.manifests || []) {
    manifests.push(await dereferenceManifest(manifest));
  }

  resource.boards = boards;
  resource.manifests = manifests;

  return {
    title: resource.title,
    boards,
    manifests,
  };
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
