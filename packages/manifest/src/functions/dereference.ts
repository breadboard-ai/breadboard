import { DereferencedBoard } from "../types/boards";
import { DereferencedManifest } from "../types/manifest";
import { Resource } from "../types/resource";
import { isDereferencedBoard } from "./is-dereferenced-board";
import { isDereferencedManifest } from "./is-dereferenced-manifest";
import { isRemoteUri } from "./is-remote-uri";
import { isResourceReference } from "./is-resource-reference";

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
