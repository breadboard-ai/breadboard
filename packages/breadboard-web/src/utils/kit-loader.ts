import { KitConstructor, Kit, asRuntimeKit } from "@google-labs/breadboard";
import { load } from "@google-labs/breadboard/kits";

const fetchAndImportKits = async (): Promise<Kit[]> => {
  const base = new URL(`${self.location.origin}/kits.json`);
  const response = await fetch(base);
  const kitList = await response.json();

  const kits = await Promise.all(
    kitList.map(async (kitURL: string) => {
      return await load(new URL(kitURL, base));
    })
  );

  return kits;
};

export const loadKits = async (kiConstructors: KitConstructor<Kit>[]) => {
  const loadedKits = kiConstructors.map((kitConstructor) =>
    asRuntimeKit(kitConstructor)
  );

  return [...loadedKits, ...(await fetchAndImportKits())];
};
