# Breadboard Hourglass Model

The layering in the Breadboard project is organized around the concept of an hourglass: lots of producers at the top layers, single protocol in the middle (the waist), and lots of consumers at the bottom layers.

The items in top layers are called the "frontends", to borrow from [compiler lingo](https://en.wikipedia.org/wiki/Compiler#Front_end). The waist is represented by the common format that connects top and bottom layers. Items in the bottom layers are called the "backends".

## The frontends

Because they all output to the same common format, there can be a great variety of frontends. For example, we currently have two different syntaxes for writing AI recipes in TypeScript and JavaScript. One can imagine a designer tool that allows creating AI recipes visually, or a Python frontend that allows writing AI recipes in Python.

Nothing stops someone from building a Python or Go or Kotlin or any other kind of frontend. As long as it generates the common format as its output, it’s part of the Breadboard hourglass stack.

## The common format

At the waist of the hourglass, there's a common format that we use to represent any AI recipe. It's a JSON object whose structure is defined by the [GraphDescriptor](https://github.com/breadboard-ai/breadboard/blob/fba76cfcdf90699bb81c41f0136aedce14e1ee1d/packages/breadboard/src/types.ts) type. Very loosely, it contains the metadata for the recipe (title, description, etc.) a list of nodes that make up the recipe, and a list of edges that connect the nodes together.

## The backends

The backends, are typically runtimes: they take the recipe, expressed in the common format and run it. At this moment, there’s only a Javascript runtime that runs in both Node and Web environments. We hope that the number of runtimes expands. For instance, wouldn’t it be cool to load a Breadboard recipe within a colab? Or maybe run it in C++? Breadboard strives for all of these options to be feasible.

Runtimes aren’t the only kinds of backends. For instance, there may be an analysis backend, which studies the topography of the recipe and makes some judgments about its integrity or other kinds of properties. What sorts of inputs does this recipe take? What are its outputs? What are the runtime characteristics of this recipe?
