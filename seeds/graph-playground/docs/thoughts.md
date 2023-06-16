Is "confiuration-store" a node type?

Two possibilities:

1. This is a node type, and any time I need to have a node that has configurable properties, I need to add a "configuration-store" node to the graph.
2. This is a service that is provided as part of the graph lifecycle, and it is something that every node can have automatically. Here, the lifecycle model becomes more complicated, but the graph structure is simpler.

What is the difference between configuration and user input? Really, not much. From the abstract perspective, they are basically the same thing: a source of data that enters the graph whenever the node is visited.

There's some difference on the outside, like config seems more static and needs to be stored separately, and the user input is ephemeral. But these seem immaterial to graph traversal.
