import { BoardResource } from "../types/boards";
import { Resource } from "../types/resource";
import { isLocalUri } from "./is-local-uri";
import { isResourceReference } from "./is-resource-reference";


export function isLocalResource(resource: Resource): resource is BoardResource {
  return isResourceReference(resource) && isLocalUri(resource.url);
}
