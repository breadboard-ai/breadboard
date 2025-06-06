# Installation

```shell
npm install -D @playwright/test@latest
npx playwright install --with-deps
```

# Running tests

```shell
cd packages/ui-tests

npm run test
```

By adding `--ui` one can watch what's happening in the browser, albeit very fast.

# Running testing IDE

Allows you to see browser recording and step by step actions being performed and a screenshot for each.

```shell
npm run test-ide
```

# Debugging tests

Running tests step by step:

```shell
npm run debug
```

# Show the detailed report for the last run

Displays testing report, performed actions and screenshots for each.

```shell
npm run show-report
```

# Running specific tests

Run tests in specific file:
```shell
npm run test smoke.spec.ts
```

Run test with title "smoke test"
```shell
npx playwright test -g "smoke test"
```

# Faster edit-test cycle
If you modify or debug tests which requires repeatedly running any of the testing debugging commands above, you should start visual editor by yourself outside of the tests. The playwright is configured to reuse the already running service `localhost:5173` if running. This will speed up the edit-test cycle.

To  start the visual editor (one time):

```shell
cd packages/visual-editor
npm run dev
```
