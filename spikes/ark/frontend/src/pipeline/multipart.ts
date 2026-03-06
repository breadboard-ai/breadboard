/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Multipart Response Parser
 *
 * Parses a `multipart/mixed` HTTP response into typed parts. Each part
 * has a filename (from Content-Disposition), a content type, and the
 * raw body bytes.
 */

export { parseMultipart, type BundlePart };

interface BundlePart {
  filename: string;
  contentType: string;
  body: Uint8Array;
}

/**
 * Parse a multipart/mixed response into its constituent parts.
 *
 * Extracts the boundary from the Content-Type header, splits on it,
 * and parses each part's headers + body.
 */
async function parseMultipart(response: Response): Promise<BundlePart[]> {
  const contentType = response.headers.get("Content-Type") ?? "";
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    throw new Error("No boundary found in Content-Type header");
  }
  const boundary = boundaryMatch[1].trim();

  const raw = await response.arrayBuffer();
  const bytes = new Uint8Array(raw);
  const text = new TextDecoder().decode(bytes);

  const parts: BundlePart[] = [];
  const delimiter = `--${boundary}`;
  const segments = text.split(delimiter);

  for (const segment of segments) {
    // Skip the preamble and the closing marker.
    if (!segment.trim() || segment.trim() === "--") continue;

    // Split headers from body by the first blank line.
    const headerEnd = segment.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerBlock = segment.slice(0, headerEnd);
    const bodyStr = segment.slice(headerEnd + 4);

    // Strip trailing \r\n from body.
    const body = bodyStr.endsWith("\r\n") ? bodyStr.slice(0, -2) : bodyStr;

    // Parse headers.
    const headers = new Map<string, string>();
    for (const line of headerBlock.split("\r\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      headers.set(key, value);
    }

    // Extract filename from Content-Disposition.
    const disposition = headers.get("content-disposition") ?? "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] ?? "unknown";

    const partContentType =
      headers.get("content-type") ?? "application/octet-stream";

    parts.push({
      filename,
      contentType: partContentType,
      body: new TextEncoder().encode(body),
    });
  }

  return parts;
}
