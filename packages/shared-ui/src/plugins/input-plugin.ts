/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";

/**
 * A plugin for the Breadboard Visual Editor which adds a new input widget which
 * collects or provides value for a given schema.
 */
export interface InputPlugin {
  match: {
    /**
     * An input widget will only be considered for use if the schema of the
     * value is a subset of the schema declared here.
     */
    schema: JSONSchema4;
  };

  /**
   * Called the first time the widget is needed in a session. Usually it should
   * load the custom element definition with a dynamic `import`.
   */
  load?: (abort: AbortSignal) => unknown | Promise<unknown>;

  instantiate: {
    /**
     * The name of the HTML Custom Element that should be instantiated when
     * Breadboard wants to display this widget.
     *
     * See {@link InputWidget} for the interface that such custom elements
     * should implement.
     */
    customElementName: string;
  };
}

/**
 * Input widget elements must conform to this interface.
 *
 * When this widget has collected a value from the user, it must dispatch an
 * {@link BreadboardInputChange} event containing that value.
 */
export interface InputWidget<T = unknown> extends HTMLElement {
  /** The current or default value. */
  value?: T;
  /** The JSON schema of the value this widget is collecting. */
  schema?: JSONSchema4;
  /**
   * Any metadata that is passed down to this instance
   */
  metadata?: Record<string, unknown>;
}

/**
 * The event which should be dispatched by a Breadboard Input Widget to indicate
 * when there is a new value.
 */
export class InputChangeEvent extends Event {
  readonly value: unknown;
  constructor(value: unknown, options?: EventInit) {
    super("bb-input-change", options);
    this.value = value;
  }
}

declare global {
  interface HTMLElementEventMap {
    "bb-input-change": InputChangeEvent;
  }
}
