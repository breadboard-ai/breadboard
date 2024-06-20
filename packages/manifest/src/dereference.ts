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
      data = await import(decodeURI(uri)).then((module) => module.default);
    }
  }

  if (isDereferencedBoard(data)) {
    return data;
  } else if (isDereferencedManifest(data)) {
    return data;
  } else {
    throw new Error("Expected a board or manifest, but got something else.");
  }
}

export async function dereferenceBoard(
  resource: BoardResource
): Promise<DereferencedBoard> {
  let data = await dereference(resource);
  if (isDereferencedBoard(data)) {
    return data;
  } else {
    throw new Error("Expected a board, but got something else.");
  }
}

export async function dereferenceManifest(
  resource: ManifestResource
): Promise<DereferencedManifest> {
  let data = await dereference(resource);
  if (isDereferencedManifest(data)) {
    return data;
  } else {
    throw new Error("Expected a manifest, but got something else.");
  }
}

export async function dereferenceAll(resource: BreadboardManifest): Promise<{
  title?: string;
  boards: DereferencedBoard[];
  manifests: DereferencedManifest[];
}> {
  let boards: DereferencedBoard[] = [];

  for (const board of resource.boards || []) {
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
