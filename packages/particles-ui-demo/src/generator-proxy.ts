/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeneratorProxy } from "./types/types";

export { GeneratorProxyImpl };

class GeneratorProxyImpl implements GeneratorProxy {
  requestAddItem(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  requestUpdateField(
    _parentId: string,
    _id: string,
    _value: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  requestUpdateDone(_id: string, _value: boolean): Promise<void> {
    throw new Error("Method not implemented.");
  }
  requestDelete(_itemId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
