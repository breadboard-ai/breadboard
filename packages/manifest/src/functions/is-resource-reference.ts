import { ResourceReference } from "../types/resource";
import { isDereferencedBoard } from "./is-dereferenced-board";
import { isDereferencedManifest } from "./is-dereferenced-manifest";


export function isResourceReference(
  resource: object
): resource is ResourceReference {
  return (
    typeof resource === "object" &&
    "url" in resource &&
    !isDereferencedBoard(resource) &&
    !isDereferencedManifest(resource)
  );
}
