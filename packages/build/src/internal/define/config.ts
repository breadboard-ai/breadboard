/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BehaviorSchema } from "@google-labs/breadboard";
import type { BreadboardType, JsonSerializable } from "../type-system/type.js";

export type PortConfig = InputPortConfig | OutputPortConfig;
export type PortConfigs = Record<string, PortConfig>;

export type InputPortConfig = StaticInputPortConfig | DynamicInputPortConfig;
export type OutputPortConfig = StaticOutputPortConfig | DynamicOutputPortConfig;

/**
 * Additional information about the format of the value. Primarily used to
 * determine how strings are displayed in the Breadboard Visual Editor.
 */
export type Format =
  | /* A string that is likely to contain multiple lines. */ "multiline"
  | /* A string that is JavaScript code. */ "javascript";

interface BaseConfig {
  /**
   * The {@link BreadboardType} that values sent or received on this port will
   * be required to conform to.
   */
  type: BreadboardType;

  /**
   * An optional title for the port. Defaults to the name of the port.
   */
  title?: string;

  /**
   * An optional brief description of this port. Useful when introspecting and
   * debugging.
   */
  description?: string;

  /**
   * Special format annotations. Primarily used as hints for the Breadboard
   * visual editor.
   */
  format?: Format;

  /**
   * Can be used to provide additional hints to the UI or to other parts of
   * the system about behavior of this particular input/output or input/output
   * port.
   */
  behavior?: BehaviorSchema[];
}

interface StaticBase {
  /**
   * If true, this port is is the `primary` input or output port of the node it
   * belongs to.
   *
   * When a node definition has one primary input port, and/or one primary
   * output port, then instances of that node will themselves behave like that
   * primary input and/or output ports, depending on the context. Note that it
   * is an error for a node to have more than 1 primary input ports, or more
   * than 1 primary output ports.
   *
   * For example, an LLM node might have a primary input for `prompt`, and a
   * primary output for `completion`. This would mean that in API locations
   * where an input port is expected, instead of writing `llm.inputs.prompt`,
   * one could simply write `llm`, and the `prompt` port will be selected
   * automatically. Likewise for `completion`, where `llm` would be equivalent
   * to `llm.outputs.completion` where an output port is expected.
   *
   * Note this has no effect on Breadboard runtime behavior, it is purely a hint
   * to the JavaScript/TypeScript API to help make board construction more
   * concise.
   */
  primary?: true;
}

/**
 * Configuration for a static import port of a Breadboard node.
 */
export interface StaticInputPortConfig extends BaseConfig, StaticBase {
  /**
   * A default value for this port.
   */
  default?: JsonSerializable;

  /**
   * If true, this port is not required and will be passed to `invoke` as
   * `undefined`.
   */
  optional?: true;
}

/**
 * Configuration for the dynamic import ports of a Breadboard node.
 */
export interface DynamicInputPortConfig extends BaseConfig {}

/**
 * Configuration for a static output port of a Breadboard node.
 */
export interface StaticOutputPortConfig extends BaseConfig, StaticBase {}

/**
 * Configuration for the dynamic output ports of a Breadboard node.
 */
export interface DynamicOutputPortConfig extends BaseConfig {
  /**
   * If true, for each dynamic input that an instance of this node type is
   * instantiated with, an output port with the same name will be automatically
   * created.
   */
  reflective?: true;
}
