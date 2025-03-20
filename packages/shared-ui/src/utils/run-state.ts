import { NodeIdentifier, HarnessRunner } from "@breadboard-ai/types";
import { InspectableRun, InspectableRunLoadResult, InspectableRunObserver, InspectableRunSequenceEntry, MutableGraphStore, RunObserverOptions, SerializedRunLoadingOptions, createRunObserver } from "@google-labs/breadboard";

import type { HarnessRunResult }from "@google-labs/breadboard/harness";
import { TopGraphObserver } from "./top-graph-observer";

export class RunState implements InspectableRunObserver {
  #runObserver: InspectableRunObserver | undefined = undefined;
  #topGraphObserver: TopGraphObserver | undefined = undefined;

  static forPastRun(run: InspectableRun): RunState {
    return new RunState(undefined, undefined, run, undefined);
  }

  static create(store: MutableGraphStore, options: RunObserverOptions, harness: HarnessRunner): RunState {
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
    return this.#needObserver()?.load(o, options);
  }
  append(history: InspectableRunSequenceEntry[]): Promise<void> {
    return this.#needObserver().append(history);
  }
  async replay(stopAt: NodeIdentifier[]): Promise<void> {
    const  maybeObserver = this.maybeRunObserver();
    if (maybeObserver) {
      await this.maybeRunObserver()?.replay(stopAt);
    }
  }

  maybeRunObserver(): InspectableRunObserver|undefined {
    if (!this.#runObserver && this.store) {
      this.#runObserver = createRunObserver(this.store!, this.options);
    }
    return this.#runObserver;
  }

  async maybeTopGraphObserver(): Promise<TopGraphObserver|undefined> {
    if (!this.#topGraphObserver) {
      if (this.pastRun) {
        this.#topGraphObserver = await TopGraphObserver.fromRun(this.pastRun);
      } else if (this.harness) {
        this.#topGraphObserver = new TopGraphObserver(this.harness);
      }
    }
    return this.#topGraphObserver;
  }

  #needObserver(): InspectableRunObserver {
    const result = this.maybeRunObserver();
    if (!result) {
      throw new Error("Unable to create observer");
    }
    return result;
  }
}