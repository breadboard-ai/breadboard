/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * When processing HTTP responses, the server may send chunks that are
 * broken in two ways:
 * - Multiple chunks might be merged together
 * - A single chunk might be broken into multiple chunks.
 *
 * This transform stream repairs such chunks, merging broken chunks and
 * splitting merged chunks.
 *
 * @returns The transform stream that repaired chunks.
 */
export declare const chunkRepairTransform: () => TransformStream<string, string>;
//# sourceMappingURL=chunk-repair.d.ts.map