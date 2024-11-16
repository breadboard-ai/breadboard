/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {startDevServer} from '@web/dev-server';

await startDevServer({
  config: {
    port: 6583,
    rootDir: '../client',
    plugins: [],
    watch: true,
    nodeResolve: true,
  },
});
