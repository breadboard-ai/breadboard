import { DataStore } from "@google-labs/breadboard";
import { createContext } from "@lit/context";

export type DataStoreContext = {
  instance: DataStore | null;
};

export const dataStoreContext = createContext<DataStoreContext>("datastore");
