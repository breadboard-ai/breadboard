# next topics

- `.as(“name”)` to rename fields, including `.as({ foo: bar, baz: boo })` to rename multiple fields
- loops, which is also
  - where `output` nodes become important for the first time
  - `.in(...)` as opposite of `.to()` can be introduced, useful when getting inputs from nodes that are defined downstream.
  - `.as({})` for control flow nodes that send no data, just trigger
- passing around boards, introducing lambdas
- building complex control nodes like `map` that are code but call other nodes/boards
- $error and error handling in general

orthogonal topics. big question is where to slot these in:

- thorough walkthrough through developer tooling, both and cli
- deploying, e.g. as cloud function, embedded in a web page
  - proxy nodes as more advanced topic
  - serialization of _state_
- building from a stock OpenAI example and turning into a graph. maybe that’s a separate tutorial, linked from the top that introduces the same things but with other examples?
- non-serializable kits,
  - that can’t be loaded via hints in the .json file, but have to be loaded ahead of time
  - note that these are privileged
  - good examples might be connecting to user auth infra in a cloud function? maybe some ux stuff on the web? or local models (though often they expose a web server..).

TODO:

- i’m assuming a new generateText that is actually a graph that calls secrets already
- output nodes
  - introduce as “just like functions can return at other places than the end, you might want to output at different times”. and say it’s mandatory for loops, as there is otherwise no return value.
  - [TODO in code:] if there is no output node, just take the result of the last node. throw an error if more than one node has no outgoing edges.
- code: serialization doesn’t yet distinguish between nested and non-nested boards, as the example above implies. maybe we should keep it that way? otherwise maybe throw warnings for dependencies that aren’t in kits.
