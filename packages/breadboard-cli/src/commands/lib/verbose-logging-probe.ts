import { Probe, ProbeMessage } from "@google-labs/breadboard";

export type VerboseLoggingCallback = (message: ProbeMessage) => Promise<void>;

export class VerboseLoggingProbe extends EventTarget implements Probe {
  #callback: VerboseLoggingCallback;

  constructor(callback: VerboseLoggingCallback) {
    super();
    this.#callback = callback;
  }

  async report(message: ProbeMessage): Promise<void> {
    return this.#callback(message);
  }
}
