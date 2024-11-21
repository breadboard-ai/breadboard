/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {startDevServer} from '@web/dev-server';

await startDevServer({
  config: {
    // TODO(aomarks) Must be this number because the board server only allows
    // this localhost port. Conflicts with visual editor, though.
    port: 5173,
    rootDir: '../client',
    plugins: [],
    watch: true,
    nodeResolve: {
      exportConditions: ['default'],
    },
  },
});
