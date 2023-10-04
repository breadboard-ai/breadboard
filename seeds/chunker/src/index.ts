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

export type ChunkerOptions = {
  maxWordsPerPassage: number;
};

class AggregateNode {
  options: ChunkerOptions;
  chunked = false;
  isText = false;
  wordCount = 0;
  chunks: string[] = [];

  constructor(node: TypedNode, options: ChunkerOptions) {
    this.isText = node.type === "text";
    this.options = options;
  }

  aggregate(child: AggregateNode) {
    //  console.log("aggregating", child.chunks);
    this.wordCount += child.wordCount;
    this.chunks = [...this.chunks, ...child.chunks];
  }

  fits(child: AggregateNode): boolean {
    return this.wordCount + child.wordCount <= this.options.maxWordsPerPassage;
  }

  addToPassages(passages: string[]) {
    const text = this.chunks.join(" ");
    if (text.length > 0) passages.push(text);
  }
}

export class BasicChunker {
  options: ChunkerOptions;

  constructor(options: ChunkerOptions) {
    this.options = options;
  }

  chunk(data: TypedNode) {
    const passages: string[] = [];
    const root = this.processNode(data, passages);
    root.addToPassages(passages);
    return passages;
  }

  processNode(docNode: TypedNode, passages: string[]): AggregateNode {
    const node = new AggregateNode(docNode, this.options);
    // console.log("processing", docNode.type);
    if (node.isText) {
      const text = (docNode as TextNode).text;
      if (text) {
        const words = text.split(" ");
        node.wordCount = words.length;
        node.chunks.push(text);
      }
      return node;
    }
    const children = (docNode as StructuralNode).children;
    if (!children) return node;

    const aggregatingNode = new AggregateNode(docNode, this.options);

    let shouldAggregate = true;
    const unchunkedNodes: AggregateNode[] = [];

    for (const child of children) {
      // console.log("child", child.type);
      const childNode = this.processNode(child, passages);
      if (childNode.chunked) {
        shouldAggregate = false;
      } else {
        aggregatingNode.aggregate(childNode);
        unchunkedNodes.push(childNode);
      }
    }
    if (!shouldAggregate || !node.fits(aggregatingNode)) {
      unchunkedNodes.forEach((unchunkedNode) => {
        unchunkedNode.addToPassages(passages);
      });
      aggregatingNode.addToPassages(passages);

      node.chunked = true;
      return node;
    }

    node.aggregate(aggregatingNode);
    return node;
  }
}
