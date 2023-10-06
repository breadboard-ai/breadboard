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
  chunked = false;
  wordCount = 0;
  chunks: string[] = [];
  passages: PassageTree = [];

  aggregate(child: AggregateNode) {
    this.wordCount += child.wordCount;
    this.chunks = [...this.chunks, ...child.chunks];
  }

  fits(child: AggregateNode, passageSize: number): boolean {
    return this.wordCount + child.wordCount <= passageSize;
  }

  addChunksAsPassagesFrom(node: AggregateNode) {
    const text = node.chunks.join(" ");
    if (text.length > 0) this.passages.push(text);
  }
}

const isText = (node: TypedNode) => node.type === "text";

export class BasicChunker {
  options: ChunkerOptions;

  constructor(options: ChunkerOptions) {
    this.options = options;
  }

  chunk(data: unknown): string[] {
    const root = this.processNode(data as TypedNode);
    root.addChunksAsPassagesFrom(root);
    const passages = root.passages.flat(Infinity as 1);
    return passages as string[];
  }

  processNode(docNode: TypedNode): AggregateNode {
    const node = new AggregateNode();
    if (isText(docNode)) {
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

    const aggregatingNode = new AggregateNode();

    let greedilyAggregatedNode = new AggregateNode();

    let shouldAggregate = true;
    const unchunkedNodes: AggregateNode[] = [];
    const childPassages: PassageTree = [];

    for (const child of children) {
      const childNode = this.processNode(child);
      if (childNode.chunked) {
        shouldAggregate = false;
        if (greedilyAggregatedNode) unchunkedNodes.push(greedilyAggregatedNode);
        greedilyAggregatedNode = new AggregateNode();
      } else {
        aggregatingNode.aggregate(childNode);
        if (this.options.greedilyAggregateSiblings) {
          if (
            childNode.fits(
              greedilyAggregatedNode,
              this.options.maxWordsPerPassage
            )
          ) {
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

    if (
      !shouldAggregate ||
      !node.fits(aggregatingNode, this.options.maxWordsPerPassage)
    ) {
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
