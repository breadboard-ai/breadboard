/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventChannel, GeneratorProxy } from "./types/types";

export { GeneratorProxyImpl };

class GeneratorProxyImpl implements GeneratorProxy {
  constructor(private readonly channel: EventChannel) {}

  requestAddItem(): Promise<void> {
    return this.channel.dispatch({
      type: "additem",
      path: [],
    });
  }

  requestUpdateField(
    parentId: string,
    id: string,
    value: string
  ): Promise<void> {
    return this.channel.dispatch({
      type: "updatefield",
      path: [parentId, id],
      value,
    });
  }

  requestUpdateDone(id: string, value: boolean): Promise<void> {
    return this.channel.dispatch({
      type: "updatefield",
      path: [id, "done"],
      value: JSON.stringify(value),
    });
  }

  requestDelete(itemId: string): Promise<void> {
    return this.channel.dispatch({
      type: "delete",
      path: [itemId],
    });
  }
}
