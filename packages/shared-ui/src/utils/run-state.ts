import { NodeIdentifier } from "@breadboard-ai/types";
import { InspectableRun, InspectableRunLoadResult, InspectableRunObserver, InspectableRunSequenceEntry, MutableGraphStore, RunObserverOptions, SerializedRunLoadingOptions } from "@google-labs/breadboard";

import type { HarnessRunner , HarnessRunResult }from "@google-labs/breadboard/harness";
import { TopGraphObserver } from "./top-graph-observer";
import { RunObserver } from "../../../breadboard/dist/src/inspector/run/run";
import { GraphObserver } from "../types/types";

export class RunState implements InspectableRunObserver {
  #runObserver: InspectableRunObserver | undefined = undefined;
  #graphObserver: GraphObserver | undefined = undefined;

  static createForPastRun(run: InspectableRun): RunState {
    return new RunState(undefined, undefined, run, undefined);
  }

  static create(store: MutableGraphStore, options: RunObserverOptions, harness?: HarnessRunner): RunState {
    return new RunState(store, options, undefined, harness);
  }

  private constructor(
      private store: MutableGraphStore | undefined,
     private options: RunObserverOptions | undefined, 
     private pastRun: InspectableRun | undefined, 
     private harness: HarnessRunner | undefined) {
    if (!store && !pastRun) {
      throw new Error("Must provide either a store or a past run");
    }
  }

  async runs(): Promise<InspectableRun[]> {
    if (this.pastRun) { 
      return [this.pastRun];
    }
    return this.maybeRunObserver()?.runs() ?? [];
  }

  resume?() {
    const maybeObserver = this.maybeRunObserver();
    if (maybeObserver?.resume) {
      maybeObserver.resume();
    }
  }

  async observe(result: HarnessRunResult): Promise<void> {
    const maybeObserver = this.maybeRunObserver();
    if (maybeObserver) {
      await maybeObserver.observe(result);
    }
  }
  load(o: unknown, options?: SerializedRunLoadingOptions): Promise<InspectableRunLoadResult> {
    return this.#demandRunObserver()?.load(o, options);
  }
  append(history: InspectableRunSequenceEntry[]): Promise<void> {
    return this.#demandRunObserver().append(history);
  }
  async replay(stopAt: NodeIdentifier[]): Promise<void> {
    const  maybeObserver = this.maybeRunObserver();
    if (maybeObserver) {
      await this.maybeRunObserver()?.replay(stopAt);
    }
  }

  maybeRunObserver(): InspectableRunObserver|undefined {
    if (!this.#runObserver && this.store) {
      this.#runObserver = new RunObserver(this.store!, this.options ?? {});
    }
    return this.#runObserver;
  }

  #demandRunObserver(): InspectableRunObserver {
    const result = this.maybeRunObserver();
    if (!result) {
      throw new Error("Unable to create observer");
    }
    return result;
  }

  async maybeGraphObserver(): Promise<GraphObserver|undefined> {
    if (!this.#graphObserver) {
      if (this.pastRun) {
        this.#graphObserver = await TopGraphObserver.fromRun(this.pastRun);
      } else if (this.harness) {
        this.#graphObserver = new TopGraphObserver(this.harness);
      }
    }
    return this.#graphObserver;
  }

  async demandGraphObserver(): Promise<GraphObserver> {
    const result = await this.maybeGraphObserver();
    if (!result) {
      throw new Error("Unable to create TopGraphObserver");
    }
    return result;
  }

  demandGraphObserverFromHarness(): GraphObserver {
    if (!this.harness) {
      throw new Error("Invalid state: RunHarness is required.");
    }
    if (!this.#graphObserver) {
      this.#graphObserver = new TopGraphObserver(this.harness); 
    }
    return this.#graphObserver;
  }
}