# @breadboard-ai/board-server

## 0.14.0

### Minor Changes

- 470e548: Start landing connector infrastructure.
- 21403d9: Delete all UI endpoints from board server
- 3128d36: Rename "Render Outputs" to "Display" and update icons.
- cd456ce: Add a `GcsAwareFetch` that nests Core Kit's fetch and does nothing
  (for now).
- 27b9c34: Unify the create and app views

### Patch Changes

- e86e6da: refigure board routing logic
- 913bc45: Minor logging, documentation, and error handling cleanups
- 5aa08f6: Remove invite mechanism
- c778fff: update board route handling
- 30685e1: Get rid of deduplication logic for board creation
- e9f7282: Teach listing about thumbnails
- 0d0953e: Temporarily remove auth check from proxy requests.
- caaa43f: Use origin for BlobDataStore
- Updated dependencies [228d3c4]
- Updated dependencies [470e548]
- Updated dependencies [81d2666]
- Updated dependencies [26fdb89]
- Updated dependencies [9d75ab2]
- Updated dependencies [e21ee39]
- Updated dependencies [66a01e0]
- Updated dependencies [fedacbd]
- Updated dependencies [856c387]
- Updated dependencies [0c0a419]
- Updated dependencies [e7abb8a]
- Updated dependencies [f11621f]
- Updated dependencies [a63fb1e]
- Updated dependencies [af10dc4]
- Updated dependencies [a2d4ee5]
- Updated dependencies [97be783]
- Updated dependencies [3dab17c]
- Updated dependencies [8cffe63]
- Updated dependencies [a84201a]
- Updated dependencies [2eee8da]
- Updated dependencies [a564054]
- Updated dependencies [9203afc]
- Updated dependencies [7e17fe2]
- Updated dependencies [0e6f849]
- Updated dependencies [7c6388f]
- Updated dependencies [2074b64]
- Updated dependencies [0c6ad80]
- Updated dependencies [a53adf0]
- Updated dependencies [da0a7a2]
- Updated dependencies [410bc4e]
- Updated dependencies [34e24f0]
- Updated dependencies [ae68b4d]
- Updated dependencies [99a5d95]
- Updated dependencies [eba969c]
- Updated dependencies [b9681e9]
- Updated dependencies [8ce093a]
- Updated dependencies [da380d1]
- Updated dependencies [7b67a8c]
- Updated dependencies [f7bb416]
- Updated dependencies [0d0953e]
- Updated dependencies [10c7441]
- Updated dependencies [ec25bbe]
- Updated dependencies [c8876ee]
- Updated dependencies [27b9c34]
- Updated dependencies [9f87f37]
- Updated dependencies [e58b680]
- Updated dependencies [eef58fa]
  - @breadboard-ai/types@0.7.0
  - @google-labs/breadboard@0.34.0
  - @breadboard-ai/jsandbox@0.6.0
  - @breadboard-ai/google-drive-kit@0.6.0
  - @breadboard-ai/data-store@0.3.3

## 0.13.0

### Minor Changes

- 3547630: Implement support for consuming Google Drive documents
- dd6b9c1: Teach board server about Gemini File API.

### Patch Changes

- 90cf916: Add missing icons
- f160fc8: Miscellaneous bug fixes to board server
- 6078b8e: update board server cors checks
- 1250fd7: deleted experimental visual editor in board server
- f6b99f0: Update blobs API
- 648b54a: Board server is an Express server
- 57e8a9a: Preliminary expressJS migration
- Updated dependencies [f466c2d]
- Updated dependencies [4ed89ea]
- Updated dependencies [b852b6c]
- Updated dependencies [98f6609]
- Updated dependencies [3547630]
- Updated dependencies [dd6b9c1]
- Updated dependencies [44fb75c]
- Updated dependencies [b872936]
- Updated dependencies [e018c92]
- Updated dependencies [a09a9c3]
- Updated dependencies [e8abf9f]
- Updated dependencies [a638ffa]
- Updated dependencies [1abb0e3]
  - @google-labs/breadboard@0.33.0
  - @breadboard-ai/types@0.6.0
  - @breadboard-ai/jsandbox@0.5.0
  - @breadboard-ai/data-store@0.3.2
  - @breadboard-ai/google-drive-kit@0.5.1

## 0.12.0

### Minor Changes

- db124b2: Switch Visual Editor and Unified Server to use statically-linked
  kits.
- c6f9889: Start all new graphs with a really blank template.
- 3e05238: Prepare blob store to be more widely used.
- eaef053: Add support for private boards.
- affff7c: Add tsc build to the board server, so that its dependents (like
  `unified-server`) get the type information.
- 2429df0: Teach board server to use access tokens.

### Patch Changes

- 220f27a: A2-related UI polish
- 510f172: Remove now-redundant build steps in board server.
- f62d17c: Teach BoardServerProvider to load from same server (again).
- 9116578: Teach visual editor about non-root board servers.
- f6223cd: Reduce config code duplication between various servers
- c5b823e: Fix a typo and unbreak board server.
- be771bf: Prototype "Make Code"
- Updated dependencies [6c223a9]
- Updated dependencies [2144bc3]
- Updated dependencies [3af8f62]
- Updated dependencies [69d315b]
- Updated dependencies [59d6fe7]
- Updated dependencies [925e4bf]
- Updated dependencies [220f27a]
- Updated dependencies [c6f9889]
- Updated dependencies [a2e7a36]
- Updated dependencies [782b7e4]
- Updated dependencies [6b6052c]
- Updated dependencies [65f89e0]
- Updated dependencies [0ad7660]
- Updated dependencies [10fee14]
- Updated dependencies [eaef053]
- Updated dependencies [0b1dc88]
- Updated dependencies [83bdea5]
- Updated dependencies [2e76cc4]
- Updated dependencies [e39ea7e]
- Updated dependencies [c9fc7b0]
- Updated dependencies [74124b8]
- Updated dependencies [9fe7195]
- Updated dependencies [63a1930]
- Updated dependencies [b93a70f]
- Updated dependencies [26b1194]
- Updated dependencies [b17362c]
- Updated dependencies [9ade1ed]
- Updated dependencies [12aea89]
- Updated dependencies [881f8ab]
- Updated dependencies [83a5186]
- Updated dependencies [40a8568]
- Updated dependencies [8e2fc1f]
  - @breadboard-ai/connection-client@0.2.0
  - @google-labs/breadboard@0.32.0
  - @breadboard-ai/types@0.5.0
  - @breadboard-ai/jsandbox@0.4.0
  - @breadboard-ai/google-drive-kit@0.5.0
  - @breadboard-ai/data-store@0.3.1

## 0.11.0

### Minor Changes

- 21b654a: Move SettingsStore into @breadboard-ai/shared-ui package

### Patch Changes

- 64bbe1b: Drive the usage of `inspect` down to four callsites.
- 7ea05ca: Remove the use of `inspect` inside `packages/breadboard`.
- 862c53c: Yuletide bug bash.
- 92fd792: Initialize GraphStore for board server invoke API.
- 4eb6d6d: Ensure that Graph-based Kits are registered before run starts.
- 078bec8: Teach Board Server about Language Packs
- 6269108: Teach board-server to work with imperative graphs.
- f2799c4: Put kit overrides in the right order.
- b23168c: Introduce file system infrastructure.
- e4521d9: Don't delete completed chunk.
- Updated dependencies [25dd1c2]
- Updated dependencies [45c7e5f]
- Updated dependencies [37e3fbd]
- Updated dependencies [71992c0]
- Updated dependencies [8722c8f]
- Updated dependencies [64bbe1b]
- Updated dependencies [e4631ff]
- Updated dependencies [96ea699]
- Updated dependencies [e22e33b]
- Updated dependencies [4a898eb]
- Updated dependencies [7ea05ca]
- Updated dependencies [cae3a3f]
- Updated dependencies [862c53c]
- Updated dependencies [f9dc26b]
- Updated dependencies [df6926d]
- Updated dependencies [84f6a3a]
- Updated dependencies [f6c31d3]
- Updated dependencies [2a6d643]
- Updated dependencies [183c9eb]
- Updated dependencies [c91a1ed]
- Updated dependencies [b685d49]
- Updated dependencies [a717ddc]
- Updated dependencies [46c9327]
- Updated dependencies [07b5676]
- Updated dependencies [66105f9]
- Updated dependencies [4eb6d6d]
- Updated dependencies [032d962]
- Updated dependencies [78da2ab]
- Updated dependencies [96b0597]
- Updated dependencies [404a08f]
- Updated dependencies [eb3fc28]
- Updated dependencies [df9b8b9]
- Updated dependencies [91e0930]
- Updated dependencies [2130bc6]
- Updated dependencies [d73587b]
- Updated dependencies [b23168c]
- Updated dependencies [e4521d9]
- Updated dependencies [a8eccc4]
- Updated dependencies [11e4c86]
- Updated dependencies [93a0a94]
- Updated dependencies [3ce820e]
- Updated dependencies [c6935b7]
- Updated dependencies [7ea3b85]
- Updated dependencies [99532f4]
  - @google-labs/breadboard@0.31.0
  - @breadboard-ai/data-store@0.3.0
  - @breadboard-ai/jsandbox@0.3.0
  - @breadboard-ai/types@0.4.0
  - @breadboard-ai/google-drive-kit@0.4.1

## 0.10.0

### Minor Changes

- 8d44489: Implement support for module-based describers
- d42ab17: Teach Board Server about sandboxed runModule.
- 9d5f11b: Convert existing declarative kits to BGL.

### Patch Changes

- Updated dependencies [9250262]
- Updated dependencies [e37a9bf]
- Updated dependencies [a13caa0]
- Updated dependencies [1131130]
- Updated dependencies [97b85d4]
- Updated dependencies [ca466cd]
- Updated dependencies [669694a]
- Updated dependencies [1fb9857]
- Updated dependencies [18dace0]
- Updated dependencies [f472c75]
- Updated dependencies [605af98]
- Updated dependencies [32b50af]
- Updated dependencies [289a26f]
- Updated dependencies [19fc2d0]
- Updated dependencies [62d627f]
- Updated dependencies [74aa9b7]
- Updated dependencies [8d44489]
- Updated dependencies [ce3a00c]
- Updated dependencies [b541052]
- Updated dependencies [c75e26f]
- Updated dependencies [856e249]
- Updated dependencies [23714f2]
- Updated dependencies [d39d473]
- Updated dependencies [1f1f7bc]
- Updated dependencies [6fe2ea2]
- Updated dependencies [db52fbc]
- Updated dependencies [cc19e8c]
- Updated dependencies [d42ab17]
- Updated dependencies [9d5f11b]
- Updated dependencies [31ddc9a]
- Updated dependencies [66041a7]
- Updated dependencies [a934fe2]
- Updated dependencies [1f1f7bc]
- Updated dependencies [2c7587a]
- Updated dependencies [9e5390d]
- Updated dependencies [1fb9857]
  - @breadboard-ai/jsandbox@0.2.0
  - @breadboard-ai/google-drive-kit@0.4.0
  - @google-labs/breadboard@0.30.0
  - @breadboard-ai/types@0.3.0
  - @breadboard-ai/data-store@0.2.6

## 0.9.0

### Minor Changes

- 35954e0: Build out GCS-based data store and fix a few bugs.
- bdf80d8: Teach Google Drive board server to refresh credentials.

### Patch Changes

- Updated dependencies [4dc21f4]
- Updated dependencies [71d42aa]
- Updated dependencies [1fc5812]
- Updated dependencies [63abd70]
- Updated dependencies [e014e42]
- Updated dependencies [6215ade]
- Updated dependencies [661beea]
- Updated dependencies [850c217]
- Updated dependencies [ee2844b]
- Updated dependencies [39d1913]
- Updated dependencies [bdf80d8]
- Updated dependencies [29762d6]
- Updated dependencies [c6f1a69]
- Updated dependencies [5332cbc]
- Updated dependencies [db93a6a]
- Updated dependencies [2d5b24e]
- Updated dependencies [8f079a1]
  - @google-labs/breadboard@0.29.0
  - @breadboard-ai/types@0.2.0
  - @breadboard-ai/connection-client@0.1.0
  - @breadboard-ai/data-store@0.2.5

## 0.8.0

### Minor Changes

- 3c2be9c: Teach board server to serve own boards internally.
- 7ad6e15: Add a `/me` API endpoint.
- 6fcd3d9: Return more informative errors.
- 23b8215: Provide board descriptions when listing boards.
- d2ec275: Teach board server to allow OPTION verb.
- ca5f932: Introduce board server blobs API endpoint

### Patch Changes

- c599557: Allow undefined descriptions.
- 7adeed8: Move LLMContent to types package.
- Updated dependencies [5aded4a]
- Updated dependencies [b640cd2]
- Updated dependencies [ffbcf09]
- Updated dependencies [7adeed8]
- Updated dependencies [ca5f932]
- Updated dependencies [049a83b]
- Updated dependencies [c031dd6]
  - @google-labs/breadboard@0.28.0
  - @breadboard-ai/data-store@0.2.4
  - @breadboard-ai/types@0.1.2

## 0.7.2

### Patch Changes

- 786063c: Add a script for batch-creating accounts
- Updated dependencies [5c015f2]
  - @google-labs/breadboard@0.27.1

## 0.7.0

### Minor Changes

- 8f9fddf: Move LightObserver to shared-ui as TopGraphObserver.
- 7e5ae47: Teach board server to expose oauth redirect.
- f55b0f6: Implement support for simple secret provider.
- 90f1662: Teach App View about OAuth connection secrets.

### Patch Changes

- 927cb32: Add a margin to the newest edge entry in the app view
- 703f17d: Various fixes to make board server work again.
- e543b2e: Unbreak the app view and only store top graph edge values.
- f10e709: Update build deps.
- 1f4ced4: Don't display title when the graph is title-less.
- 19ae55b: Teach board server node proxy about data store groups.
- 41122ea: Show the actual title, not just "true" in App View.
- Updated dependencies [703f17d]
- Updated dependencies [6136d87]
- Updated dependencies [cb8c99a]
- Updated dependencies [4dadf16]
- Updated dependencies [8f9fddf]
- Updated dependencies [f61ccf3]
- Updated dependencies [e61fa66]
- Updated dependencies [a104fa7]
- Updated dependencies [8a1b8c4]
- Updated dependencies [9797718]
- Updated dependencies [8540b93]
- Updated dependencies [81eafad]
- Updated dependencies [4c03455]
- Updated dependencies [3137076]
- Updated dependencies [157c31e]
- Updated dependencies [4cc71ee]
- Updated dependencies [a039d2e]
- Updated dependencies [9783ba8]
- Updated dependencies [aafec7f]
- Updated dependencies [1ad3001]
- Updated dependencies [d7606d3]
- Updated dependencies [84ca649]
- Updated dependencies [d9fd0ab]
- Updated dependencies [a6128a3]
  - @google-labs/breadboard@0.27.0
  - @breadboard-ai/data-store@0.2.3

## 0.6.0

### Minor Changes

- 7d46a63: Teach Visual Editor to use board server's node proxy to run boards.
- b11e1b8: Supply an image for the Open Graph card.
- 109a0af: Adds SQLite storage backend and adds 500 responses for errors
- 8be43c7: Configure allowed origins from environment var instead of Firestore
- 2d71df5: Teach dockerfile about firestore build and slim down the build
  process.

### Patch Changes

- Updated dependencies [7d46a63]
  - @google-labs/breadboard@0.26.0
  - @breadboard-ai/data-store@0.2.2

## 0.5.0

### Minor Changes

- cacd8e2: Introduce HTML preview for llm-output.
- 8b86be4: Support Google Cloud Run deployment.
- e0dccfe: Polish app view.
- dd34aba: Introduce social media previews for board server app view.
- f6c6378: Remove auto-sign-in machinery (it can't work as designed)
- 068e8cb: Introduce the invite links system for board server.
- 836058f: Teach App view to handle multimodal content.
- 001b250: Add support for unclamped outputs
- b201e07: Implement edge-based UI in board-server (and fix a bunch of bugs
  elsewhere)
- 15b5659: Teach app view to use RemoteRunner.
- a34bb69: Introduce RemoteRunner (over HTTPS)
- 34bcd9d: Auto-start board run in app view.
- e0d5971: Teach App view to stop/restart gracefully.
- 28895c3: Add support for inline controls
- 7de241c: Remove `BoardRunner`.
- a424c92: Teach remote runner to send fewer bytes over the wire.
- 79d709c: Introduce Edge event to Local and Remote runners.
- ed9ea27: Update .app endpoint

### Patch Changes

- 99510ae: Tweaks to .app UI
- 1ca21a5: [board-server] Refactor server startup
- b897c58: [board-server] Read allowed origins env variable
- 1683b5a: Add invites and toasts
- 4d04a01: Add support for deleting an invite
- 28089f1: Add new files to build set
- e292715: Add proper MIME types for CSS and JS
- 2309b88: Add date & time to event header
- c170348: Various bug fixes.
- cb01b95: Add a rudimentary home page.
- 3b73763: Fix a bug where visitor state raced with auto-run.
- 1c7e83c: Add support for running remote/local
- 4db8fc4: Animate the entries coming in a little
- d799af1: Apply some polish to .app view
- 6105d6e: Improve keyboard support for modals
- 61bace9: Check for the empty object when supplying inputs.
- 7350e8b: Register even more MIME types.
- c2cd40d: Add InspectableRunEdgeEvent
- Updated dependencies [49b3612]
- Updated dependencies [e0dccfe]
- Updated dependencies [6404cb3]
- Updated dependencies [9ad0524]
- Updated dependencies [a4301e6]
- Updated dependencies [7fdd660]
- Updated dependencies [b201e07]
- Updated dependencies [15b5659]
- Updated dependencies [0296c89]
- Updated dependencies [a34bb69]
- Updated dependencies [534d67e]
- Updated dependencies [c397d53]
- Updated dependencies [7de241c]
- Updated dependencies [a424c92]
- Updated dependencies [c2cd40d]
- Updated dependencies [262cefd]
- Updated dependencies [79d709c]
  - @google-labs/breadboard@0.25.0
  - @breadboard-ai/data-store@0.2.1

## 0.4.0

### Minor Changes

- bbf2c30: Plumb interruptible run to board server.
- 9b22cab: Implement the `run` API endpoint.
- 3f8cdd1: Introduce run store

### Patch Changes

- f27acdf: Fix build error.
- 1dc645a: Add a (failing so far) test for bubbling inputs from invoke.
- Updated dependencies [8c694ed]
- Updated dependencies [bbf2c30]
- Updated dependencies [14df6a8]
- Updated dependencies [1dc645a]
- Updated dependencies [2aabb7a]
- Updated dependencies [fb72771]
- Updated dependencies [9b22cab]
- Updated dependencies [00cc2c5]
- Updated dependencies [c04cff0]
- Updated dependencies [3f8cdd1]
- Updated dependencies [3a5ced1]
- Updated dependencies [62f8d5b]
  - @google-labs/breadboard@0.24.0
  - @breadboard-ai/data-store@0.2.0

## 0.3.0

### Minor Changes

- 1e1be2a: Teach board-server run API endpoint to run simple boards.
- 7298a47: Add simple BSE endpoint to boards.
- 1b17915: Start laying down infrastructure for `run` API endpoint.
- 2b9ef5b: Rewrire Datastore usage
- 08a4c24: Lock BSE endpoints behind a key.
- 6ffa89c: Migrate to new data-store package

### Patch Changes

- Updated dependencies [1e1be2a]
- Updated dependencies [2b094a3]
- Updated dependencies [fa93c3f]
- Updated dependencies [215bd15]
- Updated dependencies [2b9ef5b]
- Updated dependencies [a0852df]
- Updated dependencies [5ce1026]
- Updated dependencies [2312443]
- Updated dependencies [6ffa89c]
  - @google-labs/breadboard@0.23.0
  - @breadboard-ai/data-store@0.1.0

## 0.2.0

### Minor Changes

- 6f82dea: Update Visual Editor package name
- 0f9d617: Move breadboard-web to visual-editor; remove breadbuddy
- 4311bd4: Ensure that proxy endpoint uses the same rules as board server.

### Patch Changes

- 77fd526: Update board-server README
- 501c868: Fix an off-by-one slice error.
- f4397b9: Update remaining breadboard-web paths
- Updated dependencies [a925cf0]
- Updated dependencies [5cf08f1]
- Updated dependencies [ffbf163]
- Updated dependencies [8928fb7]
- Updated dependencies [d6706f2]
- Updated dependencies [5447426]
- Updated dependencies [7e1f01c]
  - @google-labs/breadboard@0.22.0

## 0.1.0

### Minor Changes

- 345738d: Implement auth support for board server.
- 417323c: Teach Board Server to use Node Proxy Server
- 2e09278: Teach board server to tell a bit about itself.
- bcfba50: Add App View to Board Server
- 631babd: Make board server deployable in more environments.
- e7147ff: Introduce Board Server.
- 714a536: A working sketch of a server.
- 3e3fcc6: Teach board server to find unique names for boards.
- 891d022: Teach board server to send username and board tags.
- c86e648: Teach board-server about vitejs.
- 225c7cc: Implement simple ACL for board server.
- 511bd9b: Add support for `published`, `title`, and `mine` metadata for board
  server.
- d419142: Use esbuild for building the server bits to allow bundling Breadboard
  in.

### Patch Changes

- ffe280f: Teach board-server to add accounts.
- 43648aa: Clean up board-server API logic.
- 2be1c4a: Create API Explorer Endpoint Placeholder
- 89dcc4f: Adds board server API key to first run
- 25064e7: Create new RunObserver on loads
- 7725341: Teach board server about `.app`.
- c80aa62: Better README.
- Updated dependencies [5a55b7d]
- Updated dependencies [f4c9d36]
- Updated dependencies [7dd8fee]
- Updated dependencies [74ade20]
- Updated dependencies [2e023b8]
- Updated dependencies [59dd0f5]
- Updated dependencies [345738d]
- Updated dependencies [417323c]
- Updated dependencies [3d5ae56]
- Updated dependencies [b3aa884]
- Updated dependencies [dfc6054]
- Updated dependencies [57e8714]
- Updated dependencies [3d7b4a7]
- Updated dependencies [7af14cf]
- Updated dependencies [bcfba50]
- Updated dependencies [0a9769b]
- Updated dependencies [9c97650]
- Updated dependencies [608edac]
- Updated dependencies [5a55b7d]
- Updated dependencies [fea8967]
- Updated dependencies [631babd]
- Updated dependencies [778f7aa]
- Updated dependencies [808f5e2]
- Updated dependencies [d131307]
- Updated dependencies [499eac0]
- Updated dependencies [00746bb]
- Updated dependencies [726d38e]
- Updated dependencies [e0fdbc3]
- Updated dependencies [83ed3b5]
- Updated dependencies [54b03b9]
- Updated dependencies [810d7fd]
- Updated dependencies [14853d5]
- Updated dependencies [714a536]
- Updated dependencies [8798514]
- Updated dependencies [eb64b9a]
- Updated dependencies [cf17933]
- Updated dependencies [1f7e37d]
- Updated dependencies [bfa65a3]
- Updated dependencies [3ab7a87]
- Updated dependencies [431fa3d]
- Updated dependencies [ef86632]
- Updated dependencies [8c90376]
- Updated dependencies [32a48a3]
- Updated dependencies [4db3ab7]
- Updated dependencies [cd73b17]
- Updated dependencies [81d82fe]
- Updated dependencies [537d9f9]
- Updated dependencies [2a7531b]
- Updated dependencies [8ec03e0]
- Updated dependencies [2e3f555]
- Updated dependencies [7c1b4cb]
- Updated dependencies [702cfe1]
- Updated dependencies [a5898df]
- Updated dependencies [bebd96e]
- Updated dependencies [91cb723]
- Updated dependencies [3e10f0f]
- Updated dependencies [c53ca01]
- Updated dependencies [4c681cb]
- Updated dependencies [fb2e584]
- Updated dependencies [9491266]
- Updated dependencies [2ace620]
- Updated dependencies [fcef799]
- Updated dependencies [08c999a]
- Updated dependencies [37418d9]
- Updated dependencies [083f69c]
- Updated dependencies [c03173d]
- Updated dependencies [d6867c0]
- Updated dependencies [8dbb1cf]
- Updated dependencies [d1a9d8a]
- Updated dependencies [5b03d96]
- Updated dependencies [f0d8d67]
- Updated dependencies [836389d]
- Updated dependencies [225c7cc]
- Updated dependencies [546752d]
- Updated dependencies [009e0ea]
- Updated dependencies [7429050]
- Updated dependencies [331d4b5]
  - @google-labs/breadboard-web@1.10.0
  - @google-labs/breadboard@0.21.0
