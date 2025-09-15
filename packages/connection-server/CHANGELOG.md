# @breadboard-ai/connection-server

## 0.7.0

### Minor Changes

- f3a3d1b: Allow client secrets to be loaded from file

### Patch Changes

- Updated dependencies [f7a7772]
- Updated dependencies [f609a62]
- Updated dependencies [342dbb8]
- Updated dependencies [d0458a0]
- Updated dependencies [48eb9b0]
- Updated dependencies [4166203]
- Updated dependencies [fbeaf8f]
- Updated dependencies [b305c1b]
- Updated dependencies [5143dad]
- Updated dependencies [cc976c3]
- Updated dependencies [492e542]
- Updated dependencies [073a296]
- Updated dependencies [ff1ce19]
- Updated dependencies [5ba1719]
- Updated dependencies [4d8a6fa]
- Updated dependencies [426ffce]
- Updated dependencies [1d6cb7b]
- Updated dependencies [42d301f]
- Updated dependencies [2b801c3]
- Updated dependencies [c52549b]
- Updated dependencies [db11ca8]
- Updated dependencies [c0d18de]
- Updated dependencies [6d9a147]
- Updated dependencies [01cee42]
- Updated dependencies [f14f927]
- Updated dependencies [e94bb52]
- Updated dependencies [a74c8cf]
- Updated dependencies [071b34d]
- Updated dependencies [5e95de6]
- Updated dependencies [0bc8d11]
- Updated dependencies [82ba7de]
- Updated dependencies [32d90b3]
  - @breadboard-ai/types@0.9.0

## 0.6.0

### Minor Changes

- c3d5854: Teach connection server to pass along errors and teach unified-server
  about allowlists.

### Patch Changes

- Updated dependencies [f488e2b]
- Updated dependencies [22b02b8]
- Updated dependencies [bb833fa]
- Updated dependencies [a7c691e]
- Updated dependencies [9923fe0]
  - @breadboard-ai/types@0.8.0

## 0.5.1

### Patch Changes

- 2655317: Update connection server package exports

## 0.5.0

### Minor Changes

- 491b152: Make connections server and npm run dev work properly.
- 40a8568: Introduce sign in plumbing to Visuale Editor runtime.

### Patch Changes

- ef965ed: refactor connection server startup

## 0.4.0

### Minor Changes

- 4dc21f4: Implement basic Google Drive Board Server

### Patch Changes

- 559ed8e: Remove GDrive from list if folder 404s
- 29f7ad4: Various small UI tweaks for GDrive
- d96f25a: Convert connection server to express
- b6eb227: Improve UX of GDrive Board Server
- b39c118: Convert connection server to express

## 0.3.2

### Patch Changes

- 90f1662: Teach App View about OAuth connection secrets.

## 0.3.1

### Patch Changes

- 84d56e0: Connection server now uses a single service config

## 0.3.0

### Minor Changes

- 98491df: The format of the secrets config file has changed (see README), and
  only one file will now be read at a time -- the one defined in the
  `CONNECTIONS_FILE` environment variable.

### Patch Changes

- 960922e: Store the OAuth client ID locally, in addition to the token details.
  Useful for APIs that require the client ID to be provided.

## 0.2.0

### Minor Changes

- 4ba1243: Migrate breadboard-ui to visual-editor

### Patch Changes

- ec2e0b1: Suggest a kill/lsof command when the port is in use
