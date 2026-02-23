import { html } from "lit";
import { ClassInfo, classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";
import { blobHandleToUrl } from "./blob-handle-to-url.js";
import { asBase64 } from "../../data/common.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { isDriveFile } from "@breadboard-ai/utils/google-drive/operations.js";

declare const MAIN_ICON: string; // VITE variable

// These must be in sync with drive-kit/operations.ts:*
const DRIVE_IMAGE_CACHE_NAME = "GoogleDriveImages";
const DRIVE_IMAGE_CACHE_KEY_PREFIX = "http://drive-image/";

export async function renderThumbnail(
  thumbnailUrl: string | null | undefined,
  googleDriveClient: GoogleDriveClient,
  classes: ClassInfo,
  alt?: string,
  showLoaderIfNoImage?: boolean
) {
  const renderTag = (src?: string | null, fade = false) => {
    if (!src && showLoaderIfNoImage) {
      return html` <div class="generating-theme">
        <span class="g-icon round filled w-500">progress_activity</span>
      </div>`;
    }

    return html`<img
      class=${classMap({ ...classes, default: !src, hidden: fade })}
      src=${src ?? MAIN_ICON}
      alt=${alt}
      @load=${(evt: Event) => {
        if (!fade || !(evt.target instanceof HTMLImageElement)) {
          return;
        }

        evt.target.classList.add("fade");
      }}
    />`;
  };

  if (!thumbnailUrl) {
    return renderTag();
  }

  const resolvedImage = async (url: string) => {
    let src: string | undefined;
    if (url.startsWith("drive:")) {
      src = await resolveImage(googleDriveClient, url);
    } else {
      src = blobHandleToUrl(url)?.href;
    }

    return renderTag(src, true);
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
    const cache = await caches.open(DRIVE_IMAGE_CACHE_NAME);
    const cacheKey = `${DRIVE_IMAGE_CACHE_KEY_PREFIX}${driveFileId}`;
    const cacheResponse = await cache.match(cacheKey);
    if (cacheResponse) {
      return await cacheResponse.text();
    }
    // Not cached - load.
    const response = await googleDriveClient.getFileMedia(driveFileId);
    const contentType = response.headers.get("content-type");
    const base64 = await asBase64(await response.blob());
    const result = `data:${contentType};base64,${base64}`;
    // Cache the result.
    // Invalidation of these entries is responsibility of the operations.ts:DriveLookupCache.
    await cache.put(
      cacheKey,
      new Response(result, {
        headers: {
          "content-type": contentType ?? "",
          "content-length": response.headers.get("content-length") ?? "",
          "fetched-at": new Date().toISOString(),
        },
      })
    );
    return result;
  } else {
    return url ?? undefined;
  }
}

/**
 * Returns image content, unlike `resolveImage()` it loads the content from urls that could have
 * went directly into src tag.
 */
export async function loadImage(
  googleDriveClient: GoogleDriveClient,
  url?: string
) {
  if (isDriveFile(url)) {
    const imageData = await resolveImage(googleDriveClient, url);
    return imageData ?? "";
  } else if (url) {
    try {
      const response = await fetch(url);
      const data = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("loadend", () => {
          const result = reader.result as string;

          resolve(result);
        });
        reader.readAsDataURL(data);
      });
    } catch (e) {
      console.warn("Unable to fetch image", e);
      return "";
    }
  }
}
