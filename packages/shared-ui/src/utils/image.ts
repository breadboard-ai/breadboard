import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { asBase64 } from "@google-labs/breadboard";
import { html } from "lit";
import { ClassInfo, classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";

export async function renderThumbnail(
  thumbnailUrl: string | null | undefined,
  defaultUrl: string,
  googleDriveClient: GoogleDriveClient,
  classes: ClassInfo,
  alt?: string
) {
  const renderTag = (src?: string | null) => {
    return html`<img
      class=${classMap(classes)}
      src=${src ?? defaultUrl}
      alt=${alt}
    />`;
  };

  if (!thumbnailUrl) {
    return renderTag();
  }

  const resolvedImage = async (url: string) => {
    const src = await resolveImage(googleDriveClient, url);
    return renderTag(src);
  };

  return until(resolvedImage(thumbnailUrl), renderTag());
}

/**
 * Translates the given url into image data [if needed] for `<img src`.
 *
 * @param url http address, inline data or Google Drive url of the image.
 * @returns image suitable for `src` tag of `img` - inline data or http address.
 */
export async function resolveImage(
  googleDriveClient: GoogleDriveClient,
  url?: string | null
): Promise<string | undefined> {
  const drivePrefix = "drive:/";
  if (url?.startsWith(drivePrefix)) {
    const driveFileId = url!.substring(drivePrefix.length);
    const response = await googleDriveClient.getFileMedia(driveFileId);
    const contentType = response.headers.get("content-type");
    const base64 = await asBase64(await response.blob());
    const result = `data:${contentType};base64,${base64}`;
    return result;
  } else {
    return url ?? undefined;
  }
}
