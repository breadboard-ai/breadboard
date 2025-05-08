# Installation

```shell
npm install -D @playwright/test@latest
npx playwright install --with-deps
```

# Running tests

```shell
cd packages/ui-tests
npx playwright test
```

By adding `--ui` one can watch what's happening in the browser, albeit very fast.

# Debugging tests

Running them step by step:

```shell
npx playwright test --debug
```
