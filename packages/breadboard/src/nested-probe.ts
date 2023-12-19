import { type ProbeDetails } from "./types.js";

type EventTransform = (event: Event) => Event;

export class NestedProbe extends EventTarget {
  #probe: EventTarget;
  #transform: EventTransform;

  constructor(probe: EventTarget, transform: EventTransform) {
    super();
    this.#probe = probe;
    this.#transform = transform;
  }

  dispatchEvent(event: Event): boolean {
    return this.#probe.dispatchEvent(this.#transform(event));
  }

  static create(probe?: EventTarget, source?: string): EventTarget | undefined {
    if (!probe) return undefined;
    return new NestedProbe(probe, (e) => {
      const probeEvent = e as CustomEvent<ProbeDetails>;
      const detail = probeEvent.detail;
      detail.nesting = (detail.nesting || 0) + 1;
      detail.sources = [...(detail.sources || []), source || ""];
      return new CustomEvent(probeEvent.type, { detail, cancelable: true });
    });
  }
}
