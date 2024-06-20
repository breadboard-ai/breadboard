import { DereferencedBoard } from "../types/boards";
import { isBglLike } from "./is-bgl-like";

export function isDereferencedBoard(
  resource: object
): resource is DereferencedBoard {
  return isBglLike(resource);
}
