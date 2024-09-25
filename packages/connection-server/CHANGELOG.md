# @breadboard-ai/connection-server

## 0.3.2

### Patch Changes

- 90f1662: Teach App View about OAuth connection secrets.

## 0.3.1

### Patch Changes

- 84d56e0: Connection server now uses a single service config

## 0.3.0

### Minor Changes

- 98491df: The format of the secrets config file has changed (see README), and only one
  file will now be read at a time -- the one defined in the `CONNECTIONS_FILE`
  environment variable.

### Patch Changes

- 960922e: Store the OAuth client ID locally, in addition to the token details. Useful for APIs that require the client ID to be provided.

## 0.2.0

### Minor Changes

- 4ba1243: Migrate breadboard-ui to visual-editor

### Patch Changes

- ec2e0b1: Suggest a kill/lsof command when the port is in use
