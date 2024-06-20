import { DereferencedBoard } from "../boards";

export function isBglLike(resource: any): resource is DereferencedBoard {
  return (
    typeof resource === "object" &&
    "nodes" in resource &&
    Array.isArray(resource.nodes) &&
    "edges" in resource &&
    Array.isArray(resource.edges)
  );
}

export function isDereferencedBoard(
  resource: object
): resource is DereferencedBoard {
  return isBglLike(resource);
}
