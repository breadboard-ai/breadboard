import { BreadboardManifest } from "./breadboardManifest";
import { ManifestReference } from "./manifestReference";

export type ManifestItem = ManifestReference | BreadboardManifest;
export default ManifestItem;
