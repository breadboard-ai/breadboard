---
layout: docs.liquid
title: Cookbook
tags:
  - miscellaneous
  - wip
date: 2020-01-01 # First in the list
---

This guide contains a collection of patterns aimed at answering "How do I do...?" style questions. It is very much a work in progress, so if something is missing do let us know, either via [Discord](https://discord.gg/breadboard) or a [GitHub Issue](https://github.com/breadboard-ai/breadboard/issues/new).

## Splitting an Array

There are two ways to do this, one of which uses a [`jsonata` component](../../kits/json/#the-jsonata-node), the other using a [`runJavascript` component](../../kits/core/#the-runjavascript-node). We'll cover both here.

In both cases we will use a `runJavascript` component to first generate an array with two numbers, which we will then split, and send over as two separate output values to our output component.

### Using JSONata

To do this our board looks like something this:

{{ "/breadboard/static/boards/cookbook/array-split-1.bgl.json" | board }}

The key is to use the [`jsonata` component](../../kits/json/#the-jsonata-node) to select out the array values with this query.

```prompt
$[0]
```

This line of JSONata is used to select the zeroth item of the "root entry", which in this case is the first number in the array. Similarly, to get the second number we can use the following JSONata query.

```prompt
$[1]
```

Our JSONata component details input should look like this:

![The JSONata input](/breadboard/static/images/cookbook/jsonata-input.png)

> [!TIP]
> JSONata can be a bit challenging to get used to, but it's also incredibly powerful and flexible. We recommend looking over the documentation and trying out the [JSONata Exerciser](https://try.jsonata.org/) to get familiar with it.

When we run the board we will see two separate outputs.

![The board output](/breadboard/static/images/cookbook/array-split-output.png)

### Using runJavascript

We can also use [`runJavascript` component](../../kits/core/#the-runjavascript-node) to obtain the values, but this is slightly more involved than using the `jsonata` component. The board itself looks similar to the `jsonata` one above.

{{ "/breadboard/static/boards/cookbook/array-split-2.bgl.json" | board }}

> [!NOTE]
> While using `runJavascript` involves a little more work than its `jsonata` counterpart, it does give us the chance to change the value or manipulate it in other ways that may be more challenging (or harder to read) in `jsonata`. Both are good approaches, though, and we can use whichever suits our end goals.

Looking at the code in the **First Number `runJavascript`** component we will see this JavaScript:

```js
const run = ({ result }) => result[0];
```

Here we use JavaScript to select out the first entry of the array by hand.

The name of the destructured parameter passed to `run` is called `result`. By default, however, you will see that a `runJavascript` component has no such input, so how do we see an additional input port called `result` on the `runJavascript` component?

![The result port on the runJavascript component](/breadboard/static/images/cookbook/array-split-dynamic-wire.png)

> [!TIP]
> We can expand on a component within the Visual Editor by double clicking on its header. When we do this for our **First Number** component we will see the additional port created called `result`.

The answer is that we create a [dynamic wire](../../visual-editor/components/#dynamic-wires) _from_ the **Number Generator** _to_ the **First Number** component, which is done by dragging from the Number Generator to the middle of the First Number component. On releasing the drag we will be asked to name the wire, and we can use the name `result` (or anything else we prefer). Whatever we call the port will then be used as the `runJavascript` input's name.

![Dragging from one port to the drop zone of another component](/breadboard/static/images/using-the-visual-editor/drop-zone.png)

## Splitting an Object

Building on the above example of [splitting an array](#splitting-an-array), we can use `jsonata` to do more advanced tasks. Suppose we have some JSON that looks like this:

```json
{
  "groupA": ["Bob", "Alice", "Fred"],
  "groupB": ["Alice", "Bob", "Alice", "Jane"]
}
```

Now we would like to grab each property of the object individually and count the number of times we encounter the name "Alice".

Our JSONata component's **Expression input** could look something like this:

```prompt
(
  $count_alices := function($vals) {
    $count($filter($vals, function($val) { $val = "Alice" }))
  };

  {
    "countGroupA": $count_alices(groupA)
  }
)
```

> [!NOTE]
> This is making use of a custom JSONata function, which is quite a deep topic. Check out the [JSONata docs](https://docs.jsonata.org/programming#functions) for more information on these, and other features of JSONata.

This JSONata will filter and then count the number of times the name `"Alice"` exists in a given list. We have one JSONata component that runs this function for the list in `"groupA"`, and another for the list in `"groupB"`. That makes our final board like this.

{{ "/breadboard/static/boards/cookbook/object-split.bgl.json" | board }}

> [!NOTE]
> We can also use `runJavascript` to do the same thing as JSONata here. If you have more experience with JavaScript than [JSONata](https://jsonata.org/), this may be a preferable path to take.

The final output from our board looks like this:

![The final output of our object split board](/breadboard/static/images/cookbook/object-split.png)

## Creating a conversation using Agent Kit

The [Agent Kit](../../kits/agents) provides the necessary building blocks for us to create an endless conversation with an LLM.

To do this we create a looper, specialist, and a human from the Agent Kit. You'll find all three in the Component selector in the bottom left of the Visual Editor. The robot icon indicates the **specialist**, the person icon the **human**, and the loop icon is the **looper**. We drag one of each onto the Visual Editor and wire them up.

![The Component Selector](/breadboard/static/images/shared/component-selector.png)

Each component handles a distinct part of the process for us.

- **Looper**. This runs the conversation flow, keeping us in an endless loop going from specialist to human and back again.
- **Specialist**. This is an LLM-backed component that takes in the conversation history and responds to the user's most recent message.
- **Human**. This captures multi-modal user input and formats it correctly for the specialist.

Now we have the components we need to wire them up.

### Wiring up the ports

1. Connect the **input's** _Context_ to the **looper's** _Context in_.
1. Connect the **looper's** _loop_ port to the **specialist's** _Context in_.
1. Connect the **specialist's** _Context out_ to the **humans's** _Context in_.
1. Connect the **human's** _Context out_ to the **looper's** _Context in_.

When you're done it should look a little like this.

{{ "/breadboard/static/boards/cookbook/agent-conversation.bgl.json" | board }}

We now need to set a couple of inputs in the **looper** and the **specialist** and we're done.

Click on the looper and enter the following **Task**:

```prompt
You are running a conversation between a user and an agent
```

And now click on the specialist and set its **Persona** to:

```prompt
You are a helpful and cheery chat agent.
You like to find out how the user is doing and how you can help them.
```

> [!TIP]
> You can give your components friendlier names by clicking on them and editing their title in the "Component details" pane.

And you're good to go. Hit **Run** and have a chat!

## Fetching data

For this pattern we generally require two things: a [`urlTemplate`](../../kits/template/#the-urltemplate-node) component and a [`fetch`](../../kits/core/#the-fetch-node) component.

The former allows us to encode some user input (if we need to do so) into a URL, and the latter makes a request over the network to that URL.

The board generally look a little like this.

{{ "/breadboard/static/boards/cookbook/fetching-data.bgl.json" | board }}

> [!NOTE]
> The `urlTemplate` component is dynamic; the ports it shows depend on the string value in its Template input.

In the above example the `urlTemplate` has the following value for its **Template input**:

```prompt
https://www.googleapis.com/books/v1/volumes?q={query}&orderBy=relevance
```

This creates the appropriate input ports on the component -- **query** -- and the input is configured to request the value as a string. This is then substituted into the URL and passed to the `fetch` component's **url input**. The result of the data fetch is then on via the **response output**.

To see this pattern in context, why not check out our [**Building a Librarian with the Agent Kit**](../librarian/) guide?
