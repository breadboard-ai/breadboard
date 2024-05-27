import { DataStore } from "@google-labs/breadboard";
import { createContext } from "@lit/context";

export const dataStoreContext = createContext<DataStore>("datastore");
