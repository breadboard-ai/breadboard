---
layout: docs.njk
title: Built-in Kit
tags:
  - reference
  - kits
---

While most nodes in Breadboard come from various kits, there are two nodes that are built-in: **input** and **output**. A good way to think about them is as if they are part of the "Built-in kit": something that you always get, no matter what other kits you choose to employ.

## Why do we need these nodes?

These two nodes serve a very important purpose: they communicate the API (or "shape") of the board. While it is definitely convenient in itself, it becomes super-important when we start composing graphs.

The **input** and **output** represent, respectively, the beginning and the end of work within a board. Every job begins with an intake of some source material and produces a deliverable. The "input" and "output" components signify those moments. The "input" component is the place where the job begins, and the "output" component (or components, depending on the job) is where it ends.

By adding "input" and "output" nodes in our graph, we not only make it easy for ourselves to spot the starting and ending points of the job -- we also make this graph _reusable_. In Breadboard, graphs can be invoked by other graphs, kind of like delegating work. If we already know that there's a team of workers that does a particular job well, we can just call that team and ask it to do the job for us. When we do that, the "input" and "output" nodes of that team will inform us what the team needs to do their job successfully.

> [!NOTE]
> To make this more concrete, here's an example. The **input** and **output** nodes of a board are used to construct the [signature of function declarations](https://ai.google.dev/gemini-api/docs/function-calling#function_declarations) when we let the [Specialist](https://breadboard-ai.github.io/breadboard/docs/kits/agents/#specialist-tools) invoke boards as tools. From the perspective of the user, it looks entirely magical: they just add a board as a possible tool that the Specialist could call and it just works. Behind the scenes, the Specialist inspects the board, determines the inputs/outputs and supplies them to the LLM as function declarations.

## The `input` node

{{ "/breadboard/static/boards/kits/built-in-input.bgl.json" | board }}

Use this node to specify the inputs for the board. The `input` node has a single fixed input configuration port named **Schema** and a variable number of output ports.

The output ports of this node are supplied from outside of the board: either by the user when running the board directly or by another board when invoking this board from it.

> [!TIP]
> It usually takes a bit of getting used to the idea that the _inputs_ of a board show up as _outputs_ of the `input` node. One metaphor that might help is that the `input` node brings the data from outside of the board.

### Input ports

![Input Schema editor](/breadboard/static/images/built-in-kit/input-schema.png)

The single configuration input port is **Schema**, which allows us to specify the number, names, types, and even sample/default values of the inputs for our board.

The Schema editor allows creating a list of input port definitions. Each definition has the following basic parameters:

- **Title** -- the user-friendly title that will be shown by the Visual Editor.

- **Required** -- whether or not this value is required for the board to function. By default, the port values are not required.

- **Type** -- the expected type of the input value. Depending on the type, there may be more additional parameters available to select.

![Input Schema types](/breadboard/static/images/built-in-kit/input-schema-types.png)

The following types are available via the Visual Editor (presented here in order of their complexity):

- **Boolean** -- the port requests a true/false (on/off) value.

- **Number** -- the port requests a numerical value.

- **String** -- the port requests a string of text. This is likely the most common primitive type. One additional parameter for this type is **Format**, which can be set to "No format" (this is just some plain text), "Markdown" (please give me Markdown), or "Multiline" (this is text where line breaks are significant).

- **Array** -- the port requests an array of values. This is a [matryoshka](hhttps://en.wikipedia.org/wiki/Matryoshka_doll) type. When chosen, the additional properties give you an opportunity to select the type of the value in the array -- and it contains all of the choices in this list.

- **Object** -- the port requests a JSON object of some shape. The shape of this object can be either undefined (any JSON object will do) or specified using the **Behavior** parameter.

![Schema Object Behavior](/breadboard/static/images/built-in-kit/schema-object-behavior.png)

The **Behavior** parameter contains the list of various useful shapes of JSON objects. These shapes are pre-defined in Breadboard. The Visual Editor will also adjust the UI of the input when running the board based on the value of this parameter, and try to find the right widget to help you enter the data.

- **No behavior** -- any shape of the object is fine. It's just JSON.

- **LLM Content** -- the input port expects the shape of the object to be suitable as input to an LLM. The exact shape of the object is specified [here](https://ai.google.dev/api/rest/v1/Content).

- **Board** -- the input port expects the value to be board-shaped. Since in Breadboard, entire boards can be passed around as values, this shape is handy for inputs that expects boards as values.

- **Stream** -- the input port expects the value to be a data stream. This one is most commonly found in the innards of Breadboard and isn't yet super-useful in the Visual Editor.

- **JSON Schema** -- the input port expects the JSON to be a [JSON Schema](https://json-schema.org/).

- **Port Spec** -- the input port expects the JSON value to be a Port Spec: the [JSON Schema] specifically formatted to inform Breadboard about the input / output port definition (literally what is described in this section).

> [!NOTE]
> The Visual Editor Schema editor produces [JSON Schema](https://json-schema.org/) for each input. This JSON schema (or more precisely, the **Port Spec** dialect of it) is what is stored in the [BGL](http://localhost:8000/breadboard/docs/concepts/#breadboard-graph-language-bgl) representation of the board.

- **Code** -- the input port expects the value to be some sort of code (JavaScript, Python), etc.

Hidden behind the "Show more" in the Visual Editor, there are a few more parameters.

![Input Schema editor expanded](/breadboard/static/images/built-in-kit/input-schema-expanded.png)

- **ID** -- allows specifying the precise identifier of the port. Typically, this is derived from the title, but whenever we want to set the ID ourselves, this is the field to change.

- **User choices** -- appears for the **String** type and allows create a simple drop-down list of choices instead of having the user type in the value.

- **Examples** -- a list of examples of the value. These are particularly useful for populating UI with some example values. In Visual Editor, these will show up as pre-filled values in the input when running a board. A good way to let the user just click "Continue" to give a board a run.

- **Description** -- allows providing a more verbose description of the port and its purpose. This value will show up in the Visual Editor when running the board.

- **Default** -- superficially, it acts and looks very similar to **Examples**, with one key difference: the **Default** value will be used by Breadboard when the input isn't supplied by the user. For instance, when a board you built is invoked by another board without supplying this port value, you can specify the **Default** to just use the default value.

> [!NOTE]
> In the scenario above, make sure that the **Required** checkbox is **not** checked. The **Default** value will only be used if the port is optional. When the **Required** is not checked and **Default** is not specified, Breadboard will "bubble up" the input: present it to the user to fill out.

### Output ports

The output ports of the `input` node are defined by **Schema**.

## The `output` node

{{ "/breadboard/static/boards/kits/built-in-output.bgl.json" | board }}

The `output` node does the inverse of what `input` does: it takes the values out of the board, back to the user (if called directly) or to another board (if invoked by that board). It has a variable number of input ports, and no output ports.

### Input ports

Similar to the `input` node, there's pre-defined input port called **Schema**, whose purpose is identical to **Schema** in the `input` node, with one important distinction: it defines the rest of the input ports (as opposed to output ports in `input`).

> [!WARNING]
> Avoid defining a port with the id of `schema` in the Schema editor. It will result in the `output` node being confused, since that is the id used by **Schema**.

### Output ports

The `output` node does not have any output ports.
