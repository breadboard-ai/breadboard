import { BoardResource } from "../boards";
import { Resource, ResourceReference } from "../resource";
import { isDereferencedBoard } from "./board-resource";
import { isDereferencedManifest } from "./manifest-resource";

export function isRemoteUri(uri: string): boolean {
  try {
    new URL(uri);
    return true;
  } catch (e) {
    return false;
  }
}

export function isLocalUri(uri: string): boolean {
  return !isRemoteUri(uri);
}

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

export function isLocalResource(resource: Resource): resource is BoardResource {
  return isResourceReference(resource) && isLocalUri(resource.url);
}

export function isRemoteResource(
  resource: Resource
): resource is ResourceReference {
  return isResourceReference(resource) && isRemoteUri(resource.url);
}
