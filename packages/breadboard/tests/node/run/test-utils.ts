/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner } from "../../../src/harness/types.js";

export type EventLogEntry = [name: string, data: unknown];

export const eventNamesFromLog = (log: EventLogEntry[]) =>
  log.map(([name]) => name);

export const queryLog = (log: EventLogEntry[], name: string) =>
  log.find(([n]) => n == name)?.[1];

export const logEvents = (runner: HarnessRunner, events: EventLogEntry[]) => {
  const eventNames = [
    "start",
    "pause",
    "resume",
    "input",
    "output",
    "secret",
    "error",
    "skip",
    "graphstart",
    "graphend",
    "nodestart",
    "nodeend",
    "end",
  ];
  eventNames.forEach((name) => {
    runner.addEventListener(name, (event) => {
      const e = event as unknown as { data: unknown };
      events.push([name, e.data]);
    });
  });
};
