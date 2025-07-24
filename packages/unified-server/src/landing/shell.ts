/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BreadboardMessage, Handler } from "@breadboard-ai/embed";

const embedHandler = window.self !== window.top ? new Handler() : undefined;

export function setPageTitle(
  title: string | null,
  appName: string,
  appSubName: string
) {
  const pageTitle = document.body.querySelector("#title");
  if (pageTitle) {
    pageTitle.textContent = appName;
  }

  const suffix = `${appName} [${appSubName}]`;
  if (title) {
    title = title.trim();
    window.document.title = `${title} - ${suffix}`;
    return;
  }

  window.document.title = suffix;
}

export function setPageInfo() {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = MAIN_ICON;
  document.head.appendChild(icon);

  if (FONT_LINK !== undefined) {
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = FONT_LINK;
    document.head.appendChild(fonts);
  }

  const fontPack = document.createElement("style");
  fontPack.textContent = FONT_PACK;
  document.head.appendChild(fontPack);
}

export function showExperimental() {
  const exp = document.body.querySelector("#experiment");
  if (!exp) {
    return;
  }

  exp.classList.add("visible");
}

export function dispatchToEmbed(message: BreadboardMessage) {
  if (!embedHandler) {
    return;
  }

  embedHandler.sendToEmbedder(message);
}

function createAnimatedGradient(
  id: string,
  i: number
): SVGRadialGradientElement {
  const gradient = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "radialGradient"
  );
  const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");

  stop1.setAttribute("stop-color", "#000000");
  stop1.setAttribute("offset", "0%");
  stop2.setAttribute("stop-color", "#000000");
  stop2.setAttribute("offset", "100%");
  gradient.setAttribute("id", `${id}-gradient`);
  gradient.appendChild(stop1);
  gradient.appendChild(stop2);

  // Make an animation for the gradient and apply it to the stop.
  const animateStop1 = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "animate"
  );
  animateStop1.setAttribute("attributeName", "stop-color");
  animateStop1.setAttribute("values", "#000000;#ffffff");
  animateStop1.setAttribute("dur", "1.3s");
  animateStop1.setAttribute("begin", `${i}s`);
  animateStop1.setAttribute("repeatCount", "1");
  animateStop1.setAttribute("fill", "freeze");
  animateStop1.setAttribute("calcMode", "spline");
  animateStop1.setAttribute("keyTimes", "0;1");
  animateStop1.setAttribute("keySplines", "0.5 0 0.3 1");

  // Now duplicate the animation and go again for the second stop.
  const animateStop2 = animateStop1.cloneNode() as SVGAnimateElement;
  animateStop2.setAttribute("values", "#000000;#000000;#ffffff");
  animateStop2.setAttribute("dur", "1.8s");
  animateStop2.setAttribute("keyTimes", "0;0.32;1");
  animateStop2.setAttribute("keySplines", "0 0 1 1; 0.35 0 0.3 1");

  stop1.appendChild(animateStop1);
  stop2.appendChild(animateStop2);

  return gradient;
}

function createImageMask(id: string, img: SVGImageElement): SVGMaskElement {
  const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
  mask.setAttribute("mask-type", "luminance");
  mask.setAttribute("id", `${id}-mask`);

  const dimensions = img.getBBox();
  const maskRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  maskRect.setAttribute("x", dimensions.x.toString());
  maskRect.setAttribute("y", dimensions.y.toString());
  maskRect.setAttribute("width", dimensions.width.toString());
  maskRect.setAttribute("height", dimensions.height.toString());
  maskRect.setAttribute("fill", `url(#${id}-gradient)`);
  mask.appendChild(maskRect);

  return mask;
}

export function showLandingImages() {
  const images = new Map([
    ["arrow-1", "/styles/landing/images/graph/arrow-1@2x.png"],
    ["input-1", "/styles/landing/images/graph/input@2x.png"],
    ["node-1", "/styles/landing/images/graph/node-1@2x.png"],
    ["arrow-2", "/styles/landing/images/graph/arrow-2@2x.png"],
    ["node-2", "/styles/landing/images/graph/node-2@2x.png"],
    ["arrow-3", "/styles/landing/images/graph/arrow-3@2x.png"],
    ["node-3", "/styles/landing/images/graph/node-3@2x.png"],
  ]);

  const showImages = () => {
    const defs = document.querySelector<SVGDefsElement>("svg defs");
    const svg = document.querySelector<SVGDefsElement>("svg");

    let i = 0;
    for (const [id] of images) {
      const img = document.querySelector<SVGImageElement>(`#${id}`);
      if (!img || !defs || !svg) {
        continue;
      }

      const gradient = createAnimatedGradient(id, i);
      const mask = createImageMask(id, img);
      defs.appendChild(gradient);
      svg.appendChild(mask);
      img.setAttribute("mask", `url(#${id}-mask)`);
      img.classList.add("visible");

      i += 0.2;
    }
  };

  let pendingImages = images.size;
  for (const [id, src] of images) {
    const img = document.querySelector<SVGImageElement>(`#${id}`);
    if (!img) {
      console.warn(`Unable to locate image with id ${id}`);
      continue;
    }

    img.addEventListener(
      "load",
      () => {
        pendingImages--;
        if (pendingImages === 0) {
          showImages();
        }
      },
      { once: true }
    );
    img.setAttribute("href", src);
  }
}
