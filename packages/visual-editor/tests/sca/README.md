# SCA Tests

Unit tests for Services, Controllers, and Actions.

## Shared Helpers

Import from `./helpers/index.js`:

```typescript
import {
  // Fixtures
  makeFreshGraph,
  makeTestProjectState,
  // Controller mocks
  makeTestController,
  makeMockSnackbarController,
  // Services mocks
  makeTestServices,
  makeMockBoardServer,
  // Combined
  makeTestFixtures,
  flushEffects,
} from "./helpers/index.js";
```

## Conventions

- **Fixtures**: Use `makeFreshGraph({ nodes, url, title })` for graph data
- **Custom needs**: Pass options to factory functions, don't copy-paste mocks
- **Backward compat**: `triggers/utils.ts` re-exports from helpers

## Running Tests

```bash
npm run test          # Run all tests
npm run test:pattern -- --test-name-pattern="Pattern"  # Filter tests
```
