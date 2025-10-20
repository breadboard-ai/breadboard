# The Agent Experiment

**Key insight 1**: Use a closed-loop setup, where Gemini is constrained to
predicting function calls only, and use a small set of functions (aks "system
functions") to drive the control flow.

The following system functions emerged through the experiment:

- `system_objective_fulfilled` -- terminates the loop, a way for Gemini to
  declare victory.

- `system_failed_to_fulfill_objective` -- terminates the loop, a way for Gemini
  to admit defeat.

- `system_request_user_input` -- requests input from a user. Unlike the typical
  open loop, we only let Gemini chat with the user through this function. This
  has an additional benefit of enabling structured UI: currently, the function
  allows Gemini to specify the type of input. We can look into the future and
  imagine that the function argument is the A2UI or some A2UI pidgin that
  literally draws consistent UI.

With these three functions, the agent is able to act as the typical open-loop
setup, but with a lot more consistent function-calling performance.

**Key insight 2**: Introduce a virtual file system (VFS), where the agent
operates on the handles to files, but not the actual data. This is a departure
of the classic Gemini setup, where the files are mixed in as `inlineData` or
`fileData` parts, and it allows for a much nicer passing of the files around
across functions and the agent.

In particular, when the agent fulfills its objective, it outputs three distinct
chunks:

- the user message -- a brief message to the user indicating success
- the actual outcome -- zero or more VFS handles
- intermediate results -- zero or more VFS handles all the files generated while
  fulfilling the objective.

This separation of what is shown to user and what is passed on to the next agent
creates a much smoother experience, because the outcome is not diluted with user
messaging, and the user messaging is not burdened with the files. Additionally,
the intermediate results can be used by the next agent as additional context.

Gemini seems to be most comfortable using the XML-like construct
`<file src="path" />` as the representation of the handle, reliably interpreting
it and even using it when interacting with the user.

The additional system function was introduced to allow agent to write its output
to file:

- `system_write_text_to_file` -- writes text into a file. This proven to be
  useful for situations where the agent generates text and needs to pass it as
  the outcome.

**Key Insight 3**: Use hyperlinks for control transfer. Since XML/HTML tags
appear to be quite comforting to Gemini, hyperlinks were introduced as a slight
leap of faith.

A hyperlink denotes the presence of another agent (peer agent) in the larger
system, and the agent is allowed to pass control to any of the agents that are
specified in the objective as hyperlinks.

For example:

```md
Ask the user (a middle schooler) about how they would like to learn today. Offer
them these choices and take them to the one they choose:

- <a href="/game">Fun Learning Game</a>
- <a href="/video">Educational Cartoon</a>
- <a href="/lesson">Engaging Interactive Lesson</a>
```

A mental model: there's a URL space full of agents, with the `"/"` as the root
agent. By default, the success or failure functions transfer control to the root
agent. However, if the objective includes hyperlinks to other agents, our agent
has the option to pass control to them.

This enables fairly complex routing scenarios, and Gemini seems to grok this
mental model quite well.

## Experimenting

Create `.env` file with `GEMINI_API_KEY`.

Run

```sh
npm run dev
```

The evals are in [src/eval-set.ts](src/eval-set.ts). To pick a different eval,
change the id in [src/index.ts](src/index.ts):

```ts
const objective = evalSet.get("valid-eval-id-goes-here");
```
