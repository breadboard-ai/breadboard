---
layout: docs.njk
title: Building a Librarian with the Agent Kit
tags:
  - guide
---

> [!WARNING]
>
> This doc is being refactored right now, becoming more of a guide. Please pardon our dust. If you're looking for the Agent Kit node reference, its new home is [here](../).

## What we'll build

At the end of this tutorial, we will have a simple agent that helps us find interesting books. Given a topic, the agent will chat with us a little bit, trying to get a few more details on what exactly we're looking for in a book, then use the Google Books API to find some choices, and finally present them to us in a nice outline.

The finished board is here and you're welcome to play with it first. When you run it for the first time, it will ask you for the Gemini API Key. Get it at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

{{ "/breadboard/static/boards/librarian/final.bgl.json" | board }}

This board uses the Agent Kit, a collection of components designed to help build asynchronous, semi-autonomous agents. You can read more about it in the [Agent Kit Reference](/breadboard/docs/kits/agents/). Additionally, we'll use the built-in "input" and "output" components. These are described in the [Built-in Kit Reference](/breadboard/docs/reference/kits/built-in/).

To build this board, we will use the Breadboard Visual Editor, which is a tool for rapid prototyping AI systems. You can learn more about about all the different features and capabilities of Breadboard Visual Editor in the [Visual Editor Reference](/breadboard/docs/reference/visual-editor/).

> [!TIP]
> At any point in the tutorial, you can click "See in Visual Editor" link at the left bottom corner of the board diagram. This will open the Breadboard Visual Editor and load the board. So if you're not feeling like typing and doing all the dragging and dropping of nodes, you can just follow along by opening each link.

## Step 1: Creating a Blank board

First, we'll create a [blank board](/breadboard/docs/reference/visual-editor/#creating-a-new-board). Let's name it something like `my-librarian.bgl.json` and give it a proper title and description, like "My Librarian" and "A simple agent that helps me find interesting books".

{{ "/breadboard/static/boards/librarian/1.bgl.json" | board }}

## Step 2: Add Summarizer

As our next step, let's add a Summarizer [specialist](../#specialist) to this board. The easiest way to do this is by grabbing the little robot icon on the bottom left corner and dragging it onto the board.

Now, let's remove the existing edge connecting the `input` and `output` nodes. We can do this by clicking on the edge to highlight it and then pressing "Delete" (or "Backspace" for non-Mac users).

With the old edge deleted, let's connect input and output to the Specialist. Click and drag from the input's "Context" port to the Specialist's "Context In" port and then from the Specialist's "Context Out" port to the output's "Context" port.

{{ "/breadboard/static/boards/librarian/2.bgl.json" | board }}

Finally, let's education our Specialist and imbue it with purpose.

We'll start with naming it appropriately. Click on the node representing the Specialist and in the left (or bottom, if your Breadboard editor window portrait-shaped) panel, click on "Node Details". Then Type in "Summarizer" as the node's title. You will also see that the title changes in the visual editor as well.

Moving on to the Persona, let's type in something like this:

```prompt
You are an expert librarian. Given any topic,
you can come up with a list of book recommendations.
```

As a Task, let's put:

```prompt
Come up with a list of 5-7 recommendations.
Reply in markdown.
```

{{ "/breadboard/static/boards/librarian/2a.bgl.json" | board }}

Let's give our simple board a whirl.

To start the board, open it in Visual Editor and click "Run" in the Activity panel. The Activity panel will show the progress of the board's run, and the first thing we'll see is the request for input. This is exactly what we would expect, since the first node in the board is the "input". Let's type some subject that we're interested in. I love systems thinking and utopian sci fi, so that's what I'll enter.

![First Run Input](/breadboard/static/images/agent-kit/first-run-input.png)

After entering the text, click the "Continue" button. This will result in a flurry of activity in the Activity panel, and after a few seconds, the board will deliver our first output.

![First Run Output](/breadboard/static/images/agent-kit/first-run-output.png)

Cool! We made a Librarian board. High fives all around. The results are good and the choices are classic.

Except...

After running this board with a few different inputs (it's easy -- just click "Run" again), we notice that the book recommendations are kind of meh. True, they are good books, but for an avid reader such as myself, it looks as if the board just cycles through "the usual suspects".

And that's understandable. Our current design relies on the Gemini's (the large language model that is behind the Specialist) parametric knowledge, and as such, is unlikely to produce fresh results or dig up forgotten gems for us.

To do that, we need to improve on our board design.

## Step 3: Adding a Researcher

Let's add another Specialist. We will name this Specialist the "Researcher" and give it a Persona of:

```prompt
You are a library researcher. Based on the provided topic,
formulate the query to call the Google Books API
to search for the right book for the user.
```

To get better results, we will give this Specialist the ability to call Google Books API.

To do so, click on "Create array" button under Tools, then select "Custom URL" from the dropdown and paste this URL into the box that pops up under the dropdown menu:

```text
https://breadboard.live/boards/@dimitri/tool-google-books.bgl.json
```

This particular board will call the Google Books API with a specified query and return a bunch of results.

> [!NOTE]
> Because boards are stored in the BGL format (which is just JSON), they are very easy to share and refer to. Just publish their BGL and give it a [stable URL](https://www.w3.org/Provider/Style/URI).

Now, let's wire them up. Delete the wire connecting the input to Librarian, and instead connect the input to the Researcher, and then wire Researcher to the Librarian. We just built our first workflow.

Both Specialists do only one task, and pass their work results along.

Speaking of which -- let's also teach the Librarian to look over the Researcher's work and consider it when providing recommendations. To do that, we'll tweak the Librarian's Persona as follows:

```prompt
You are an expert librarian. Given any topic,
and the raw book search results,
you can come up with a list of book recommendations.
```

{{ "/breadboard/static/boards/librarian/3.bgl.json" | board }}

If we try to run this board now, we'll find that it gives much more interesting results. It does particularly well with narrow or unusual topics. For instance, here's a result of running with the query of "educational books for children about butterfly migration". Where the lone Librarian would fall back onto "The Very Hungry Caterpillar" or hallucinate book titles, working together with Researcher, it produces genuinely useful results.

![Run result with Researcher](/breadboard/static/images/agent-kit/butterflies.png)

This is what makes Specialists so powerful. By themselves, they are pretty good, single mindedly focused on their particular task. When organized together and armed with tools, they become a helpful agent.

TODO:

- Add Interview Planner (Looper)

{{ "/breadboard/static/boards/librarian/add-interview-planner.bgl.json" | board }}

{{ "/breadboard/static/boards/librarian/wire-interview-planner.bgl.json" | board }}

- Add Interviewer (Specialist)

{{ "/breadboard/static/boards/librarian/add-interviewer.bgl.json" | board }}

- Add Interviewee (Human)

{{ "/breadboard/static/boards/librarian/add-interviewee.bgl.json" | board }}

Final board:

{{ "/breadboard/static/boards/librarian/final.bgl.json" | board }}
