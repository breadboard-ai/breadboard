/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type TextRun = {
  text: {
    textRun: string;
  };
};

export type StructuralElementType = "paragraph" | "bodySection" | "listItem";

export type StructuralElement = {
  elements: {
    [Type in StructuralElementType]: StructuralElement | TextRun;
  };
};

export type DataToChunk = {
  body: {
    content: StructuralElement;
  };
};

export class BasicChunker {
  chunk(data: DataToChunk) {
    return data.body.content;
  }
}
