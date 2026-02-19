/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach, afterEach, mock } from "node:test";
import { setDOM, unsetDOM } from "../fake-dom.js";

import {
  toImageBlob,
  triggerDownload,
  triggerClipboardCopy,
  resetForTesting,
} from "../../src/a2ui/0.8/ui/utils/image-helpers.js";

suite("toImageBlob", () => {
  beforeEach(() => {
    setDOM();
    resetForTesting();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("resolves with a PNG blob after drawing the image", async () => {
    const fakeBlob = new Blob(["fake"], { type: "image/png" });

    const fakeCtx = {
      drawImage: mock.fn(),
    };

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: mock.fn(() => fakeCtx),
      toBlob: mock.fn((cb: (blob: Blob | null) => void) => {
        cb(fakeBlob);
      }),
    };

    const fakeImg = {
      src: "",
      naturalWidth: 800,
      naturalHeight: 600,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      if (tag === "img") return fakeImg;
      return {};
    });

    const blobPromise = toImageBlob("https://example.com/photo.png");

    assert.ok(fakeImg.onload, "onload handler should be assigned");
    fakeImg.onload();

    const result = await blobPromise;

    assert.strictEqual(result, fakeBlob);
    assert.strictEqual(fakeCanvas.width, 800);
    assert.strictEqual(fakeCanvas.height, 600);
    assert.strictEqual(fakeCtx.drawImage.mock.callCount(), 1);
    assert.strictEqual(fakeCanvas.toBlob.mock.callCount(), 1);
  });

  test("rejects when the canvas context cannot be created", async () => {
    const fakeCanvas = {
      getContext: mock.fn(() => null),
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      return { src: "", onload: null, onerror: null };
    });

    await assert.rejects(toImageBlob("https://example.com/photo.png"), {
      message: "Unable to create canvas context",
    });
  });

  test("rejects when the image fails to load", async () => {
    const fakeCtx = { drawImage: mock.fn() };
    const fakeCanvas = {
      getContext: mock.fn(() => fakeCtx),
    };

    const fakeImg = {
      src: "",
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      if (tag === "img") return fakeImg;
      return {};
    });

    const blobPromise = toImageBlob("https://example.com/broken.png");

    assert.ok(fakeImg.onerror, "onerror handler should be assigned");
    fakeImg.onerror();

    await assert.rejects(blobPromise, {
      message: "Unable to load image",
    });
  });

  test("rejects when toBlob returns null", async () => {
    const fakeCtx = { drawImage: mock.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: mock.fn(() => fakeCtx),
      toBlob: mock.fn((cb: (blob: Blob | null) => void) => {
        cb(null);
      }),
    };

    const fakeImg = {
      src: "",
      naturalWidth: 100,
      naturalHeight: 100,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      if (tag === "img") return fakeImg;
      return {};
    });

    const blobPromise = toImageBlob("https://example.com/photo.png");

    assert.ok(fakeImg.onload);
    fakeImg.onload();

    await assert.rejects(blobPromise, {
      message: "Unable to create blob",
    });
  });
});

suite("triggerDownload", () => {
  beforeEach(() => {
    setDOM();
    resetForTesting();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("converts to blob URL, creates anchor, clicks, and revokes", async () => {
    const fakeBlob = new Blob(["fake"], { type: "image/png" });
    const fakeCtx = { drawImage: mock.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: mock.fn(() => fakeCtx),
      toBlob: mock.fn((cb: (blob: Blob | null) => void) => cb(fakeBlob)),
    };
    const fakeImg = {
      src: "",
      naturalWidth: 100,
      naturalHeight: 100,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const fakeAnchor = {
      href: "",
      download: "",
      click: mock.fn(),
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      if (tag === "img") return fakeImg;
      if (tag === "a") return fakeAnchor;
      return {};
    });

    const fakeCreateObjectURL = mock.fn(() => "blob:fake-url");
    const fakeRevokeObjectURL = mock.fn();
    globalThis.URL.createObjectURL = fakeCreateObjectURL;
    globalThis.URL.revokeObjectURL = fakeRevokeObjectURL;

    const downloadPromise = triggerDownload("https://example.com/photo.png");

    // Trigger the image load that toImageBlob awaits.
    assert.ok(fakeImg.onload);
    fakeImg.onload();

    await downloadPromise;

    assert.strictEqual(fakeAnchor.href, "blob:fake-url");
    assert.strictEqual(fakeAnchor.download, "Image");
    assert.strictEqual(fakeAnchor.click.mock.callCount(), 1);
    assert.strictEqual(fakeCreateObjectURL.mock.callCount(), 1);
    assert.strictEqual(fakeRevokeObjectURL.mock.callCount(), 1);
  });

  test("uses the provided filename", async () => {
    const fakeBlob = new Blob(["fake"], { type: "image/png" });
    const fakeCtx = { drawImage: mock.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: mock.fn(() => fakeCtx),
      toBlob: mock.fn((cb: (blob: Blob | null) => void) => cb(fakeBlob)),
    };
    const fakeImg = {
      src: "",
      naturalWidth: 100,
      naturalHeight: 100,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const fakeAnchor = {
      href: "",
      download: "",
      click: mock.fn(),
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      if (tag === "img") return fakeImg;
      if (tag === "a") return fakeAnchor;
      return {};
    });

    globalThis.URL.createObjectURL = mock.fn(() => "blob:fake-url");
    globalThis.URL.revokeObjectURL = mock.fn();

    const downloadPromise = triggerDownload(
      "https://example.com/photo.png",
      "MyPhoto"
    );

    assert.ok(fakeImg.onload);
    fakeImg.onload();

    await downloadPromise;

    assert.strictEqual(fakeAnchor.download, "MyPhoto");
  });
});

suite("triggerClipboardCopy", () => {
  beforeEach(() => {
    setDOM();
    resetForTesting();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("converts to blob and writes to clipboard", async () => {
    const fakeBlob = new Blob(["fake"], { type: "image/png" });
    const fakeCtx = { drawImage: mock.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: mock.fn(() => fakeCtx),
      toBlob: mock.fn((cb: (blob: Blob | null) => void) => cb(fakeBlob)),
    };
    const fakeImg = {
      src: "",
      naturalWidth: 100,
      naturalHeight: 100,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    mock.method(document, "createElement", (tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      if (tag === "img") return fakeImg;
      return {};
    });

    const fakeClipboardWrite = mock.fn(async () => {});
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { write: fakeClipboardWrite } },
      configurable: true,
    });
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: class {
        constructor(readonly items: Record<string, Blob>) {}
      },
      configurable: true,
    });

    const copyPromise = triggerClipboardCopy("https://example.com/photo.png");

    assert.ok(fakeImg.onload);
    fakeImg.onload();

    await copyPromise;

    assert.strictEqual(fakeClipboardWrite.mock.callCount(), 1);
  });
});
