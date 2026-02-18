/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

export { toImageBlob, triggerDownload, triggerClipboardCopy, resetForTesting };

const IMAGE_TYPE = "image/png";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

/** @internal Clears cached canvas/context so tests can inject fresh stubs. */
function resetForTesting(): void {
  canvas = null;
  ctx = null;
}

/**
 * Loads an image URL onto an off-screen canvas and returns it as a PNG blob.
 *
 * Reuses a single module-level canvas/context pair to avoid per-call
 * allocation overhead.
 */
function toImageBlob(imgUrl: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (!canvas) {
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d");
    }

    if (!ctx) {
      reject(new Error("Unable to create canvas context"));
      return;
    }

    const img = document.createElement("img");
    img.src = imgUrl;

    const renderCtx = ctx;

    img.onerror = () => {
      reject(new Error("Unable to load image"));
    };

    img.onload = () => {
      if (!canvas) {
        reject(new Error("Unable to create blob"));
        return;
      }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      renderCtx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to create blob"));
          return;
        }
        resolve(blob);
      }, IMAGE_TYPE);
    };
  });
}

/**
 * Downloads the given image URL by converting it to a blob URL first.
 *
 * This avoids lag for large data URIs — the blob is created locally and
 * the anchor click triggers an instant download from the object URL.
 */
async function triggerDownload(
  imgUrl: string,
  filename = "Image"
): Promise<void> {
  const blob = await toImageBlob(imgUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copies the given image URL to the clipboard as a PNG blob.
 */
async function triggerClipboardCopy(imgUrl: string): Promise<void> {
  const blob = await toImageBlob(imgUrl);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}
