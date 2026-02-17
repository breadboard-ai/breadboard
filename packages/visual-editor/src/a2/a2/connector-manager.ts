/**
 * @fileoverview Connector types.
 */

import type { ExportDescriberResult, ToolOutput } from "./common.js";
import { JsonSerializable, Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export type ConnectorInfo<
  C extends Record<string, JsonSerializable> = Record<string, JsonSerializable>,
> = {
  url: string;
  configuration: C;
};

export type ListMethodOutput = {
  list: ListToolResult[];
};

export type ListToolResult = {
  url: string;
  description: ExportDescriberResult;
  passContext: boolean;
};

export type InvokeMethodOutput = ToolOutput;

export type CanSaveMethodOutput = {
  canSave: boolean;
};

export type ToolHandler<
  C extends Record<string, JsonSerializable>,
  A extends Record<string, JsonSerializable> = Record<string, JsonSerializable>,
> = {
  title: string;
  list(
    moduleArgs: A2ModuleArgs,
    id: string,
    info: ConnectorInfo<C>
  ): Promise<Outcome<ListMethodOutput>>;
  invoke(
    moduleArgs: A2ModuleArgs,
    id: string,
    info: ConnectorInfo<C>,
    name: string,
    args: A
  ): Promise<Outcome<InvokeMethodOutput>>;
};
