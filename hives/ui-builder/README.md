# UI Builder — Quality Hill Climb Environment

Use this hive to hill climb on UI builder quality.

## 1. One-Time Setup

Ensure your development environment is configured before starting:

- **Environment Variables**: Verify your `.env` file in `packages/bees/.env`
  contains a valid `GEMINI_KEY`.
- **Python Setup**: Run `npm run setup -w bees` to initialize the virtual
  environment and install dependencies.

## 2. Run the Evaluation Session

Start the evaluation session using the top-level npm script. This executes a
batch eval against the `ui-builder` template:

```bash
npm run eval:ui-builder
```

This command copies this hive to a pristine working directory under
`packages/bees/results/<timestamp>/hive`, boots the `ui-builder` template, and
runs all cycles autonomously without modifying your source files.

## 3. Wait for Completion

Let the session run to completion. The batch runner will print progress logs and
summarize the final cycle status, total duration, and task counts to stderr.

## 4. Examine Results in Hivetool

Open Hivetool (the framework's developer workbench) in your browser: 👉
https://breadboard-ai.github.io/breadboard/hivetool/

When prompted by Hivetool's directory picker, point it at
`packages/bees/results/`. Selecting the parent results folder allows you to
seamlessly select between different timestamped runs using Hivetool's built-in
hive picker.

In Hivetool, inspect:

- **Tasks Tab**: Check generated component code, tickets, and final file
  manifests.
- **Sessions Tab**: Drill into turn-by-turn reasoning, tool calls
  (`execute_bash` for bundling, `files_write_file`), and token usage metrics.

## 5. Tweak Template & Skills

To adjust agent instructions, use Hivetool's hive picker to switch to your
source hive (`hives/ui-builder/`):

- **Templates Tab**: Use the inline editor to refine the objective, system
  prompt, or model parameters. Press "Save" (or Cmd+S) to write changes directly
  to `config/TEMPLATES.yaml`.
- **Skills Tab**: Modify or add skills in hivetool or edit directly in `skills/`
  directory.

When you are ready to review your next run, simply switch back to
`packages/bees/results/` using the hive picker.

## 6. Iterate

Repeat steps 2 through 5 until the generated UI meets your high standard of
excellence. Happy hill climbing!
