import { BreadboardManifest } from "..";
import { DereferencedBoard } from "../types/boards";
import { DereferencedManifest } from "../types/manifest";
import { dereferenceBoard } from "./dereference-board";
import { dereferenceManifest } from "./dereference-manifest";

export async function dereferenceAll(resource: BreadboardManifest): Promise<{
  title?: string;
  boards: DereferencedBoard[];
  manifests: DereferencedManifest[];
}> {
  let boards: DereferencedBoard[] = [];

  for (const board of resource.boards || []) {
    boards.push(await dereferenceBoard(board));
  }

  let manifests: DereferencedManifest[] = [];
  for await (const manifest of resource.manifests || []) {
    manifests.push(await dereferenceManifest(manifest));
  }

  resource.boards = boards;
  resource.manifests = manifests;

  return {
    title: resource.title,
    boards,
    manifests,
  };
}
