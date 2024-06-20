import { isRemoteUri } from "./is-remote-uri";

export function isLocalUri(uri: string): boolean {
  return !isRemoteUri(uri);
}
