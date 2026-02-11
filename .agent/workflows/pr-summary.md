---
description: Create a PR description summary for the current changes
---

# PR Summary Workflow

When the user asks for a PR summary, PR description, or similar:

1. Write the summary to `.pr-description.md` in the **root of the repository** (e.g., `/path/to/breadboard/.pr-description.md`)

2. Use this format:
   ```markdown
   # PR Summary: [Brief Title]

   ## What
   [1-2 sentence description of what changed]

   ## Why
   [1-2 sentence explanation of the motivation]

   ## Changes
   [Bullet points of key changes, grouped by component/area]

   ## Testing
   [How to verify the changes work]
   ```

3. Keep it fairly short - this is for GitHub PR descriptions, not documentation.

**IMPORTANT**: Never write to `packages/*/PR.md` or any other location. Always use `.pr-description.md` at the repo root.
