/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type TypedNode = {
  type: string;
};

export type TextNode = TypedNode & {
  type: "text";
  text: string;
};

export type StructuralNode = TypedNode & {
  children: TypedNode[];
};

export type DocumentNode = TextNode | StructuralNode;

// TODO: Make it a BasicChunker option
const MAX_WORDS_PER_PASSAGE = 10;

class AggregateNode {
  chunked = false;
  isText = false;
  wordCount = 0;
  chunks: string[] = [];

  constructor(node: TypedNode) {
    this.isText = node.type === "text";
  }

  aggregate(child: AggregateNode) {
    this.wordCount += child.wordCount;
    this.chunks = [...this.chunks, ...child.chunks];
  }

  fits(child: AggregateNode): boolean {
    return this.wordCount + child.wordCount <= MAX_WORDS_PER_PASSAGE;
  }
}

const addToPassages = (node: AggregateNode, passages: string[]) => {
  const text = node.chunks.join(" ");
  if (text.length > 0) passages.push(text);
};

export class BasicChunker {
  chunk(data: TypedNode) {
    const passages: string[] = [];
    const node = this.processNode(data, passages);
    console.log("passages", passages);
    return node;
  }

  processNode(docNode: TypedNode, passages: string[]): AggregateNode {
    const node = new AggregateNode(docNode);
    if (!node.isText) {
      const text = (docNode as TextNode).text;
      if (text) {
        const words = text.split(" ");
        node.wordCount = words.length;
        node.chunks.push(text);
      }
      return node;
    }
    const aggregatingNode = new AggregateNode(docNode);

    let shouldAggregate = false;
    const unchunkedNodes: AggregateNode[] = [];
    const children = (docNode as StructuralNode).children;
    if (children) {
      for (const child of children) {
        const childNode = this.processNode(child, passages);
        if (childNode.chunked) {
          shouldAggregate = false;
        } else {
          aggregatingNode.aggregate(childNode);
          unchunkedNodes.push(childNode);
        }
      }
    }
    if (!shouldAggregate || !node.fits(aggregatingNode)) {
      unchunkedNodes.forEach((unchunkedNode) => {
        addToPassages(unchunkedNode, passages);
      });
    }
    addToPassages(node, passages);
    node.chunked = true;
    return node;
  }
}
