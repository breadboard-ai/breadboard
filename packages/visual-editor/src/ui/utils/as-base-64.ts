/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function asBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject("Reader result is not a string");
        return;
      }

      const [, content] = reader.result.split(",");
      resolve(content);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
