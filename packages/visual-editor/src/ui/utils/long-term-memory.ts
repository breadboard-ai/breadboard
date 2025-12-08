// /**
//  * @license
//  * Copyright 2023 Google LLC
//  * SPDX-License-Identifier: Apache-2.0
//  */

// const PREFIX = "bb-remember";

// // TODO: Replace this with IDB.
// class LongTermMemory {
//   async store(key: string, value: string) {
//     if (!globalThis.localStorage) {
//       return;
//     }

//     globalThis.localStorage.setItem(`${PREFIX}-${key}`, value);
//   }

//   async retrieve(key: string): Promise<string | null> {
//     if (!globalThis.localStorage) {
//       return null;
//     }

//     return globalThis.localStorage.getItem(`${PREFIX}-${key}`);
//   }
// }

// export const longTermMemory = new LongTermMemory();
