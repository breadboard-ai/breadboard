/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Closure
 *
 * When a `board()` turns into a closure because data is wired in, The behavior
 * changes:
 *
 * As soon as the first input is wired to what is returned by `board()`, e.g.
 * by calling `myBoard.in({ ...})` or `otherNode.to(myBoard)`, a `closure`
 * node is being created (in the lexical scope where `board` was called), and
 * those wires go into it. The `closure` node will have a `$board` output,
 * formatted as `BoardCapability` that includes the serialized graph of the node
 * that the board was originally about and with all the incoming inputs in
 * `args` of the serialized graph.
 *
 * If passed as an input to another node, it appears as if it was a
 * Value<BoardCapability> with a key of `$prompt`, attached to the closure node.
 * This happens inside `BuilderNode.addInputsAsValues`, which then turns it into
 * a wire.
 *
 * If invoked itself, it will do the above and then create an `invoke` node that
 * reads that `$board` and invokes the closure.
 *
 * When a closure is received as an input and then invoked (`inputs.closure()`
 * or `inputs.closure.invoke()`), it'll be turned into a wire from that input to
 * a newly created `invoke` node and invoked. This happens in `Value.invoke` and
 * NodeProxy's default handler for proxied methods that aren't reserved words.
 *
 * If serialized, it'll return the graph hanging off the `invoke` node above.
 *
 * Note that if you want to return the serialized graph of the closure, then you
 * can create a board around the definition and return an output `{ myBoard }`
 * and run the the outer board. This will compute the additional input values
 * and add them. `await`ing the output of the outer board automatically
 * serializes the closure graph if it wasn't already.
 */
