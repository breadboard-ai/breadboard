import { DereferencedManifest, ManifestResource } from "../types/manifest";
import { dereference } from "./dereference";
import { isDereferencedManifest } from "./is-dereferenced-manifest";

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
