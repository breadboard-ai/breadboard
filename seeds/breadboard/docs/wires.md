# The wiring spec

The `wire` method on node has two arguments:

- the wire spec
- the node with which to wire

Consider the statement below:

```js
a.wire("foo->bar", b);
```

The first argument `"foo->bar"` is the wire spec, and the second argument is the node `b` with which the node `a` is wired.

The wire spec describes how control will flow between the two nodes. By specifying wires, we form a directed graph with cycles out of nodes.

The spec is a string designed to be flexible and easy to type.

In its long form, it has the following format:

```r
{property}{direction}{property}{qualifier}
```

Here's an example of the long-form spec:

```sh
"foo->bar."
```

In this spec:

- `foo` is the first property
- `->` is direction
- `bar` is the second property
- `.` is the qualifier.

There are several shorthand forms that make typing out all of the parts of the spec unnecessary.

## Direction

The wire spec always contains direction.

For example:

```js
a.wire("->", b);
```

The spec above describes that after node `a` is visited, node `b` will be a candidate to visit. Conversely:

```js
a.wire("<-", b);
```

This spec describes that after node `b` is visited, node `a` may be visited.

Left-to-right direction is assumed when the direction is not specified:

```js
// These two are equivalent.
a.wire("", b);
a.wire("->", b);
```

## Properties

The wire spec usually describes how properties are passed between two nodes.

```js
a.wire("foo->bar", b);
```

The spec above contains both direction and properties that are being passed. The right arrow (`->`) betwen `foo` and `bar` specifies the direction: `a` to `b`.

The `foo` and `bar` specify how the properties from one node are being passed to another. This wire spec describes the following: take the `foo` property from the output of node `a` and pass it as `bar` property as input of node `b`.

This spec can be written in another way:

```js
// Equivalent to above.
b.wire("bar<-foo", a);
```

When no properties are specified, the spec describes a control-only wire: no data is being passed between the nodes, just direction in which the nodes are visited.

## Same-name property shorthand

If the property names on both sides are the same, they can be omitted:

```js
a.wire("foo->", b);
// Equivalent to:
a.wire("foo->foo", b);
// Also equivalent to:
a.wire("foo", b);
// ... and also to:
b.wire("<-foo", a);
// ... or:
b.wire("foo<-", a);
// ... and even:
a.wire("->foo", b);
```

## All-properties shorthand

Sometimes, we want to pass all properties from one node to another. To do this, use the `*` specifier:

```js
a.wire("*->", b);
```

The spec above describes the following: take all properties from the output of node `a` and pass them as inputs to property `b`. It has the same set of equivalents as the "same-name" shorthand:

```js
// All statements below are equivalent to the one above:
a.wire("*", b);
a.wire("->*", b);
b.wire("<-*", a);
b.wire("*<-", a);
```

## Constant qualifier

Adding a dot (`.`) at the end of the spec marks the wire as "constant". Constant wires remember the last value that passed through them and make it always available for consumption by the receiving node.

```js
// This is a constant wire:
a.wire("foo->bar.", b);
// And so is this:
a.wire("foo->bar.", b);
// And this:
a.wire("->bar.", b);
```

When the board travels the constant wire again, it updates the value.

The constant values become useful when boards are wired to have loops. They can be used to indicate parts of the loop that never change (or change rarely).

## Optional qualifier

When there is a question mark (`?`) at the end of the spec, the wire is considered "optional". The optional wire signals to the board that the receiving node does not need the input from this value to be visited.

```js
// optional wire:
a.wire("foo->bar?", b);
// Also optional wire:
a.wire("foo->?", b);
// And also this:
a.wire("<-bar?", b);
```

Optional nodes are useful when we want to supply additional data to the node, but don't want to prevent it from being visited if this data is not available.

Only one qualifier can be used at a time in the wire spec. A wire can't be both optional and constant.
