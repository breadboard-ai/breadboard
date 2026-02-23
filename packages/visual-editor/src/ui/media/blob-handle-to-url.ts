/**
 * Blob handles usually look like "../../blobs/<UUID>". It's a bit unclear why
 * they are serialized with a very specific relative path and whether that's
 * always consistent, so let's be lenient and assume any URL with a blobs/ path
 * component is a blob.
 *
 * The reason why they are like this is because they're relative to graph URL.
 */
export const BLOB_HANDLE_PATTERN = /^[./]*blobs\/(.+)/;

export function blobHandleToUrl(handle: string): URL | undefined {
  const blobMatch = handle.match(BLOB_HANDLE_PATTERN);
  if (blobMatch) {
    const blobId = blobMatch[1];
    if (blobId) {
      return new URL(`/board/blobs/${blobId}`, window.location.href);
    }
  } else if (
    handle.startsWith("data:") ||
    handle.startsWith("http:") ||
    handle.startsWith("https:") ||
    handle.startsWith("drive:")
  ) {
    return new URL(handle);
  }
  return undefined;
}
