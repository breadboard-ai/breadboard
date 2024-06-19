import { AdditionalProperties } from ".";
import { ResourceReference } from "./resource";

export type Node = AdditionalProperties & {};
export type Edge = AdditionalProperties & {};

export type ReferencedBoard = AdditionalProperties &
  ResourceReference & {
    nodes?: never;
    edges?: never;
  };

export type BoardResource = DereferencedBoard | ReferencedBoard;

export type DereferencedBoard = AdditionalProperties & {
  url?: never;
  nodes: Node[];
  edges: Edge[];
};
