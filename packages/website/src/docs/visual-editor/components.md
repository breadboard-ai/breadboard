---
layout: docs.njk
title: Components
tags:
  - visualeditor
date: 2020-01-03 # Third in the list
---

**Components** are key to Breadboard. We create components, configure them, name them, and wire them together to create our boards. By default a blank board contains two components: an **input** and an **output**, with the input wired to the output.

![The input & output components in the default blank board](/breadboard/static/images/using-the-visual-editor/input-output.png)

> [!NOTE]
> For more about the input and output components, take a look at our [Built-in Kit reference documentation](../../reference/kits/built-in/).

### Adding and Removing Components

#### Adding a Component

To add a component to our board we drag it from the component selector found in the bottom left corner of the Visual Editor.

![The component quick selector](/breadboard/static/images/shared/component-selector.png)

The selector has two main sections. On the left is a button, named **Components**, which shows the entire collection of kits and the components they contain when clicked. On the right is a selection of shortcuts to commonly-used components from our [Agent Kit](../../reference/kits/agent-kit/).

![The component selector showing all components and kits](/breadboard/static/images/using-the-visual-editor/all-component-selector.png)

Here we can search for a particular component we're interested in, as well as see short descriptions of what each component offers.

We can add the component to the board by dragging it from the list into the main area of the Visual Editor.

![A runJavascript component being added to the board](/breadboard/static/images/using-the-visual-editor/drag-node.png)

#### Removing a Component

To remove a component either click on it and press the delete key (or Backspace) on your keyboard, or click on the three dots to the right of the component and choose **Delete component** in the overflow menu.

![The overflow menu of a component](/breadboard/static/images/using-the-visual-editor/component-overflow.png)

> [!TIP]
> If you accidentally remove a component or wire you can bring it back by using the **undo** option in the top navigation bar, or by pressing `Cmd`/`Ctrl` + `Z` on your keyboard.

### Updating Component Information

We can update the title, log level, and description of the component using the **Component details** section in the right hand pane.

![The component details section](/breadboard/static/images/using-the-visual-editor/component-details.png)

The **title** is shown in the **Activity Panel** when a board is run, and the **log level** determines if the component's output is shown in the Activity Panel only, or if it should be shown in the Preview as well.

If the log level is set to **Debug** it will show only in the Activity Panel. If, however, it is set to **Information** it will be shown in the Activity Panel _and_ the Preview.

> [!NOTE]
> We do not currently use the component description within the Visual Editor UI, but this may change in the future.

### Changing a Component's Inputs

Most components can be configured in some way. When you select a component in the Visual Editor its configuration options are shown in the right hand pane in the **Input** section just below the **Component details**. The exact options depend on the component itself, but as one example the inputs for the `runJavascript` component are shown below.

![The runJavascript component details](/breadboard/static/images/using-the-visual-editor/runjavascript-inputs.png)

In the case of this particular component we see:

1. **code** The code we wish to run.
2. **name** The name of the function to invoke from the `code` input set above.
3. **raw** Whether or not the output of the component should be used as-is, or whether it should be wrapped in a port called `result`.

> [!NOTE]
> For more information on what ports are, take a look at our [reference on Inputs and Outputs](../io/).

Each component is different, however, and the description of what each port does can be found just below its name in the component's **Input** section.

#### Setting input and output schemas

Input and Output components stand slightly apart from other components in that they have a single schema input which, when changed, adds or removes other input and output ports from the component itself.

By default our input component looks like this.

![The default input component schema](/breadboard/static/images/using-the-visual-editor/default-input.png)

> [!TIP]
> By default components are "collapsed", showing only a single input and output port. By double clicking on their name (or using the component's overflow menu) you can expand them to see all the ports they contain.

Suppose, however, we wanted to add an extra output port from our input component, such that alongside `Context` it has a number called `Foo`. We can this by clicking the **Add a port** button in the **Schema** section of the right hand pane.

![The Add a port button in the schema editor](/breadboard/static/images/using-the-visual-editor/add-a-port.png)

> [!NOTE]
> There are quite a few options for types supported within a port's schema. A very common one is `LLM Content`, which aligns with the [Gemini API Content](https://ai.google.dev/api/rest/v1/Content) and which is used in the components like the [Agent Kit's Specialist](../../kits/agents/#specialist).

We can then change the title and type of our new port to be `Foo` and Number, respectively. After that we should see that the input component now has an additional port called `Foo`.

![The input component with a modified schema](/breadboard/static/images/using-the-visual-editor/input-post-change.png)

> [!NOTE]
> Input and output components are not the only "shapeshifters" in Breadboard. The [Template Kit](../../reference/kits/built-in/) includes other components that use an input string to derive their additional ports.

### Wiring Components Together

#### Adding wires

To wire two components together we click drag from the output port of one component to the input port of another component.

![Dragging from one port to another](/breadboard/static/images/using-the-visual-editor/wire-nodes.png)

Depending on the component we can wire an output port to one of its own input ports, too, thereby creating a loop.

> [!NOTE]
> We are currently working on [limiting the ports that can be connected](https://github.com/breadboard-ai/breadboard/issues/2298) based on their types. Until that feature lands, however, it is important to check that ports are of a compatible type.

#### Removing wires

To remove a wire, click on it and press the delete key (or Backspace) on your keyboard.

#### Dynamic wires

In some cases the ports on a component are not fixed, and we can create a wire by dragging from a port to the target component. For example, the `runJavascript` component supports the addition of dynamic wires as inputs.

![Dragging from one port to the drop zone of another component](/breadboard/static/images/using-the-visual-editor/drop-zone.png)

When we release the cursor we will be prompted to name the port on the target component.

![Naming the newly created wire's ports](/breadboard/static/images/using-the-visual-editor/create-new-wire.png)

After which we see that is now a new port on the runJavascript called, in this case at least, `context`.

![The new dynamic ports](/breadboard/static/images/using-the-visual-editor/updated-ports.png)

> [!NOTE]
> If we delete a dynamic wire the port that was created to service the port is also removed.
