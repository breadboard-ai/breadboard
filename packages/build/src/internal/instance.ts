/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputPort, OutputPort, type PortConfigMap } from "./port.js";

export type InputPorts<I extends PortConfigMap> = {
  [PortName in keyof Omit<I, "*">]: InputPort<I[PortName]>;
};

export type OutputPorts<O extends PortConfigMap> = {
  [PortName in keyof Omit<O, "*">]: OutputPort<O[PortName]>;
};
