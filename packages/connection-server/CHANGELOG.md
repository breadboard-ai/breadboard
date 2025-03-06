# @breadboard-ai/connection-server

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
