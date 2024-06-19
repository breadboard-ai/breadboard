import { BoardResource } from "./boards";
import { ResourceReference } from "./resource";

export type ManifestResource = DereferencedManifest | ReferencedManifest;

export type DereferencedManifest = {
  title?: string;
  boards?: BoardResource[];
  manifests?: ManifestResource[];
};

export type ReferencedManifest = ResourceReference & {
  boards?: never;
  manifests?: never;
};
