---
layout: docs.njk
title: Building our First Tool
tags:
  - guide
---

At the end of this guide, we will have an agent that writes poems based on today's date. The agent will use a **Tool** to obtain the date, and write a poem in a style specified by the user.

{% include "api-key.njk" %}

{{ "/breadboard/static/boards/first-tool/final.bgl.json" | board }}

## What are Tools?

One of the most powerful ideas in Breadboard is that boards are composable. We often start boards with some fundamental building blocks, things like inputs and outputs, templating, or fetching data, but very quickly we start to compose these baseline components into boards.

Suppose, then, that we make a board that does one thing really well. Maybe it gets the weather for a given location, or maybe it writes some data to a spreadsheet. It could even be as simple as getting today’s date. This board becomes a meaningful “component” in its own right, and something we will likely want to re-use in future projects.

These boards are our **Tools**.

The good news is that, within Breadboard, boards can call other boards! When there’s a task that we want our board to accomplish we don’t need to reinvent the wheel if there’s another one that already does the task admirably. The Specialist component (found in the [Agent Kit](../../kits/agents/)) can be handed an array of Tools to choose from to complete its task.

Let's create the simplest possible Tool and ask a Specialist to make use of it.

## Step 1. Create the main board

Let’s create a blank board in the [Breadboard Visual Editor](https://breadboard-ai.web.app/) by clicking on the menu icon in the top left corner and choosing the New board option.

![A view of the Visual Editor UI showing the "New Board" option](/breadboard/static/images/first-tool/0-create-board.png)

When we create the board, we can give a title "Rhyme of the Day". The generated board file name can be left as-is.

> [!NOTE]
> When we create a new board the Visual Editor will ask which "Provider" we want to use. A Provider is a store of boards, and the Visual Editor automatically creates a Provider using the browser's built-in storage. By default all the boards you create are stored in your browser, and it's up to you if and how you share them with others.

Now we've created a board, we can use the Board Details pane to set the description to "Creates a poem based on today's date".

![Setting the title and description in the Board Details pane](/breadboard/static/images/first-tool/1-board-details.png)

Let's add a Specialist. We can drag one of these from the quick selection bar in the bottom corner of the Visual Editor. It's the one with the little robot icon! 🤖

![The quick selection bar in the Visual Editor](/breadboard/static/images/first-tool/2-quick-selection.png)

Now we can wire the Poet in. Delete the wire that connects the input to the output, and then drag a wire from input to the Poet, and Poet to the output.

> [!TIP]
> To delete wires click on them and then press the Delete key (or Backspace) on your keyboard.

Let’s also change the Specialist's name to "Poet", and let's set its Persona to:

```prompt
You write wonderful poems that incorporate today's date.
```

![Setting the details for the Poet Specialist](/breadboard/static/images/first-tool/3-poet-setup.png)

Our board now looks like this.

{{ "/breadboard/static/boards/first-tool/1-initial-board.bgl.json" | board }}

Let's run the board by clicking the **Run** button in the lower right part of the Visual Editor and put something like this in the input box:

```prompt
Give me a poem about today.
```

![Running our board](/breadboard/static/images/first-tool/4-board-input.png)

> [!TIP]
> You may notice that we are asked about which Gemini model we want to use. If you don't want to choose the model each time, go to the Settings panel (found in the top right hand corner overflow menu), head to the "Inputs" section, and create an item called **model**, and set its value to something like **gemini-1.5-flash-latest**.

Well, we may get a poem, but we immediately discover that our Poet doesn’t really know what today’s date is. If your output is anything like mine, it will look like this:

![An output from the board that tells us the Specialist does not know today's date](/breadboard/static/images/first-tool/5-board-output.png)

That's disappointing! So how do we solve this problem? With another board that provides the date and time, and which our Poet can call into as a **Tool**.

## Step 2. Create a Tool Board

Let’s make a new board and call it something like **Today’s Date**. Let’s update the description for the board. We’ll enter:

```prompt
Returns the exact date and time in the current timezone
```

We'll also want to check the box in the Board details pane that declares that this board is a Tool.

![The Visual Editor showing our new Tool Board](/breadboard/static/images/first-tool/6-new-board.png)

> [!NOTE]
> Our Specialist is going to choose from the array of Tools we give it based on the titles and descriptions of the boards. For it to choose well, then, we need to make sure that the title and description of our Tools are as clear as possible.

What needs to be on our board? Only two things, really: a **runJavascript** component which will emit the date as a string, and an **Output** component to collect its value. We don’t need any inputs from the user, so we can delete the **Input** component that we got when we made a new board. Now, let’s head to the selector in the bottom left corner where we got our Specialist, click on **+ Nodes**, enter **runJavascript** in the search and drag one of them out onto the editor.

Let's rename it to "Date Retriever" and wire it to the **Output** component. Let’s also set the Output's type to “String”, since that’s what we’ll be returning from our `runJavascript` component.

![The Schema for the Output component set to the String type](/breadboard/static/images/first-tool/7-output-type.png)

We should also see that the Date Retriever `runJavascript` component is configured with a “name”, which is the JavaScript function we want to be invoked. By default that name is set to “run”, which is fine for our purpose. We fill in the “code”, which should look something like this:

```javascript
const run = () => new Date().toString();
```

This means we now have a `run` function that can be called, and which will return today's date as a string.

After we wire things together our board should look like this:

{{ "/breadboard/static/boards/first-tool/tool-today-s-date.bgl.json" | board }}

> [!NOTE]
> The `runJavascript` component lets us run arbitrary code to get jobs done. It’s an extremely flexible and useful component to use, but it’s also worth knowing that the JavaScript code is run in a worker. This means that the component has a fresh JavaScript context when run, and it will only “know” about the data passed into it. Or, in other words, if we were to store something in a global variable from an earlier `runJavascript` component, it would _not_ be available in another.

Let's run it and see what we get.

![The Tool Board output showing today's date and time in the current timezone](/breadboard/static/images/first-tool/8-tool-output.png)

Excellent! Let's save it and go back to our original board, where we will teach the Specialist to use our new Tool.

## Step 3. Teaching Specialists to use Tools

Once we're back in our original board, let’s create a new Specialist whose role is to get the date and time for us. We’ll rename the Specialist to “Date Retriever” and let’s enter the following in the Input pane for the **Persona**:

```prompt
You invoke tools to answer queries.
```

And this for the **Task**:

```prompt
Use the tool to get today's date.
```

And now in the tools section, let’s create an array, and let’s set an entry to point at our newly-minted **Date Retrieval Tool**, meaning that our new Specialist's configuration should look like this:

![The Date Retriever's configuration, showing persona, task, and our Date Retrieval tool](/breadboard/static/images/first-tool/9-retriever-configuration.png)

> [!NOTE]
> Creating a whole Specialist for this one task may seem excessive, but it’s important to remember that some Tools may have significant complexity and warrant having their own Specialist to handle them . Another reason why having separate Specialists is a good idea is to composability. Wherever we can we want to allow Specialists to do one job, and one job well, so we can reuse Specialists (and Tools) to make more complex boards. Our Poet just writes poems, and now we have another Specialist -- the Date Retriever -- who deals in dates and times.

## Step 4. Updating the Poet

Finally let’s update the Poet so that it knows to use the date from the Date Retriever Specialist:

```prompt
Write a poem for the user in the style requested, using today's date.
If the user doesn't provide a style, feel free to choose your own.
```

> [!TIP]
> It's important to be specific with Specialists. We want to ensure that the Poet uses the the style requested _and_ today's date in its poetic works, and unless we specify that there are no guarantees that it will!

And now let’s wire the input to the Date Retriever, and the Date Retriever to the Poet, meaning the final board should look like this:

{{ "/breadboard/static/boards/first-tool/final.bgl.json" | board }}

Now let’s run it.

In our poet’s task we said the user might request a style, so let’s put in “limerick” and see what we get.

```prompt
There once was a date, June the twenty-seventh,
A day full of sunshine and mirth.
With summer's sweet breeze,
And rustling of trees,
It felt like a brand new earth.
```

We can also try it "In the style of [William Wordsworth](https://en.wikipedia.org/wiki/William_Wordsworth)" and we may get something like:

```prompt
The sun, a golden orb in skies of blue,
Hangs high above, a summer's gentle hue.
It is the twenty-seventh day of June,
And nature sings her song, a sweet commune.

The fields are green, with barley tall and strong,
While larks ascend, their melodies prolong.
A gentle breeze whispers through rustling leaves,
And peace descends, as slumber nature weaves.

The world is still, in quiet contemplation,
A day for rest, and joyful celebration.
For summer's bounty fills the air with scent,
And life itself, a wondrous gift, is sent.

So let us pause, and marvel at the day,
And breathe the air, in gratitude we pray.
For on this day, in June's sweet, golden light,
We find a peace, that makes our spirits bright.
```

Fantastic – we get poems that incorporate today's date!

So we’ve created two boards: one that is a Tool to get today’s date, and another that uses it to create a poem based on today's date. From here we could expand on our prompting, and maybe have the Poet incorporate other information, like the timezone or the year. We could also pass it -- say -- images as part of our input and ask it to use that, too.

## Bonus Points – Remix your own Poet!

If you want a fun challenge, see if you can figure out how to make the Tool take a date and return the day of the week. Combine that with a year and maybe a name, and you could turn it into a birthday poem generator for a friend or family member! 💖
