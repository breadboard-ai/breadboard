import { DereferencedBoard } from "../types/boards";


export function isBglLike(resource: any): resource is DereferencedBoard {
  return (
    typeof resource === "object" &&
    "nodes" in resource &&
    Array.isArray(resource.nodes) &&
    "edges" in resource &&
    Array.isArray(resource.edges)
  );
}
