---
description: Run coverage after writing tests and fill gaps iteratively
---

# Coverage-Driven Testing

Use tests for fast feedback during development. Run coverage only at the end
to find and plug remaining gaps.

## During Development

Use `npm run test:file` for fast iteration as you write code and tests:

```bash
cd packages/visual-editor && npm run build:tsc
npm run test:file -- './dist/tsc/tests/sca/path/to/test.js'
```

## When Work Is Complete

// turbo-all

Once all tests pass and you consider the work done, run coverage to check
for gaps:

1. **Run coverage** (this also runs the full test suite):
```bash
cd packages/visual-editor && npm run coverage 2>&1 | tail -10
```

2. **Extract per-file coverage** for the files you edited:
```bash
cat packages/visual-editor/coverage/coverage-summary.json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  const files=process.argv.slice(1); \
  files.forEach(f => { \
    const key=Object.keys(d).find(k=>k.endsWith(f)); \
    if(key) { const c=d[key]; console.log(f+':'); \
      console.log('  lines:',c.lines.pct+'%','('+c.lines.covered+'/'+c.lines.total+')'); \
      console.log('  branches:',c.branches.pct+'%','('+c.branches.covered+'/'+c.branches.total+')'); \
      console.log('  functions:',c.functions.pct+'%','('+c.functions.covered+'/'+c.functions.total+')'); \
    } else console.log(f+': NOT FOUND'); \
  });" \
  "src/sca/path/to/file1.ts" \
  "src/sca/path/to/file2.ts"
```
Replace the file paths at the end with the actual files you edited.

3. **For any file below ~98% lines** (matching the main branch standard):
   - Check the coverage HTML report at `coverage/<relative-path>.html` for
     specific uncovered lines and branches
   - Write targeted tests for the gaps
   - Build and run those tests with `npm run test:file`

4. **Re-run coverage** to confirm the gaps are filled:
```bash
npm run coverage 2>&1 | tail -10
```

5. Repeat steps 3-4 until satisfied.

## Notes

- Focus on **branch coverage** (if/else, switch, early returns) — branches
  are the most likely source of bugs.
- Guard clauses (e.g. `if (!editor) return`) are easy to miss but important.
- Always check that mock shapes match real API signatures (e.g. `ReadonlyMap`
  vs `Map`).
- **Do not** try to compute a delta from main — CI handles that. Focus on
  absolute coverage of the files being changed.
- The `coverage-summary.json` file is at:
  `packages/visual-editor/coverage/coverage-summary.json`
