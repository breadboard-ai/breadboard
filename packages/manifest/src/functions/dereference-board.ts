import { BoardResource, DereferencedBoard } from "../types/boards";
import { dereference } from "./dereference";
import { isDereferencedBoard } from "./is-dereferenced-board";


export async function dereferenceBoard(
  resource: BoardResource
): Promise<DereferencedBoard> {
  let data = await dereference(resource);
  if (isDereferencedBoard(data)) {
    return data;
  } else {
    throw new Error("Expected a board, but got something else.");
  }
}
