import { BoardResource } from "./boards";
import { ResourceReference } from "./resource";

export type ManifestResource = ReferencedManifest | DereferencedManifest;

export type DereferencedManifest = {
  title?: string;
  boards?: BoardResource[];
  manifests?: ManifestResource[];
};

export type ReferencedManifest = ResourceReference & {
  boards?: undefined;
  manifests?: undefined;
};
