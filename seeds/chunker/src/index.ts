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
  greedilyAggregateSiblings: boolean;
};

export type PassageTree = Array<string | PassageTree>;

class AggregateNode {
  options: ChunkerOptions;
  chunked = false;
  isText = false;
  wordCount = 0;
  chunks: string[] = [];
  passages: PassageTree = [];

  constructor(node: TypedNode, options: ChunkerOptions) {
    this.isText = node.type === "text";
    this.options = options;
  }

  aggregate(child: AggregateNode) {
    this.wordCount += child.wordCount;
    this.chunks = [...this.chunks, ...child.chunks];
  }

  fits(child: AggregateNode): boolean {
    return this.wordCount + child.wordCount <= this.options.maxWordsPerPassage;
  }

  addChunksAsPassagesFrom(node: AggregateNode) {
    const text = node.chunks.join(" ");
    if (text.length > 0) this.passages.push(text);
  }
}

export class BasicChunker {
  options: ChunkerOptions;

  constructor(options: ChunkerOptions) {
    this.options = options;
  }

  chunk(data: TypedNode) {
    const root = this.processNode(data);
    root.addChunksAsPassagesFrom(root);
    const passages = root.passages.flat(Infinity as 1);
    return passages;
  }

  processNode(docNode: TypedNode): AggregateNode {
    const node = new AggregateNode(docNode, this.options);
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

    let greedilyAggregatedNode = new AggregateNode(docNode, this.options);

    let shouldAggregate = true;
    const unchunkedNodes: AggregateNode[] = [];
    const childPassages: PassageTree = [];

    for (const child of children) {
      const childNode = this.processNode(child);
      if (childNode.chunked) {
        shouldAggregate = false;
        if (greedilyAggregatedNode) unchunkedNodes.push(greedilyAggregatedNode);
        greedilyAggregatedNode = new AggregateNode(docNode, this.options);
      } else {
        aggregatingNode.aggregate(childNode);
        if (this.options.greedilyAggregateSiblings) {
          if (childNode.fits(greedilyAggregatedNode)) {
            greedilyAggregatedNode.aggregate(childNode);
          } else {
            unchunkedNodes.push(greedilyAggregatedNode);
            greedilyAggregatedNode = childNode;
          }
        } else {
          unchunkedNodes.push(childNode);
        }
      }
      if (childNode.passages.length) childPassages.push(childNode.passages);
    }
    if (this.options.greedilyAggregateSiblings) {
      unchunkedNodes.push(greedilyAggregatedNode);
    }

    if (!shouldAggregate || !node.fits(aggregatingNode)) {
      unchunkedNodes.forEach((unchunkedNode) => {
        node.addChunksAsPassagesFrom(unchunkedNode);
      });
      if (childPassages.length) node.passages.push(childPassages);

      node.chunked = true;
      return node;
    }

    node.aggregate(aggregatingNode);
    return node;
  }
}
