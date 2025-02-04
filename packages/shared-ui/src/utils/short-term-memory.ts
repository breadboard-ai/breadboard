// /**
//  * @license
//  * Copyright 2023 Google LLC
//  * SPDX-License-Identifier: Apache-2.0
//  */

// import { type Schema } from "@google-labs/breadboard";

// /**
//  * A simple "Was I supposed to remember something?" flag.
//  */
// export class ShortTermMemory {
//   #computeKey(properties: Record<string, Schema>) {
//     return Object.values(properties)
//       .map((value) => value.title)
//       .join("#");
//   }

//   rememberSaving(properties: Record<string, Schema>) {
//     globalThis.sessionStorage.setItem(this.#computeKey(properties), "yes");
//   }

//   didSave(properties: Record<string, Schema>): boolean {
//     return !!globalThis.sessionStorage.getItem(this.#computeKey(properties));
//   }
// }
