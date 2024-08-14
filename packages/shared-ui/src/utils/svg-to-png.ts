/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

export function svgToPng(svgSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ctx) {
      console.error("Fail");
      reject("Unable to find canvas context to generate image");
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = svgSrc;
    const fragment = template.content;
    const root = fragment.querySelector("svg");
    const viewBox = root?.getAttribute("viewBox");
    if (!viewBox || !root) {
      reject("Unable to parse SVG image");
      return;
    }

    const [, , width, height] = viewBox.split(" ");
    root.setAttribute("width", width);
    root.setAttribute("height", height);

    const serializer = new XMLSerializer();
    const imgSrc = `data:image/svg+xml;base64,${btoa(
      serializer.serializeToString(fragment)
    )}`;

    const img = new Image();
    img.crossOrigin = "use-credentials";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = (e) => {
      console.error(e);
      reject(`Unable to load image`);
    };

    img.src = imgSrc;
  });
}
