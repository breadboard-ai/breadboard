import { Resource, ResourceReference } from "../types/resource";
import { isRemoteUri } from "./is-remote-uri";
import { isResourceReference } from "./is-resource-reference";


export function isRemoteResource(
  resource: Resource
): resource is ResourceReference {
  return isResourceReference(resource) && isRemoteUri(resource.url);
}
