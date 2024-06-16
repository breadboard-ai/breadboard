---
layout: docs.njk
title: Building a Librarian with the Agent Kit
tags:
  - guide
---

> [!WARNING]
>
> This doc is being refactored right now, becoming more of a guide. Please pardon our dust. If you're looking for the Agent Kit node reference, its new home is [here](../).

## Inputs and outputs

You may have noticed that the pictures we have so far have these different-looking nodes, in addition to workers, labeled "input" and "output". These represent another important concept. Every job begins with an intake of some source material and produces a deliverable. The "input" and "output" nodes signify those moments. The "input" node is the place where the job begins, and the "output" node (or nodes, depending on the job) is where it ends.

By adding "input" and "output" nodes in our graph, we not only make it easy for ourselves to spot the starting and ending points of the job -- we also make this graph _reusable_. In Breadboard, graphs can be invoked by other graphs, kind of like delegating work. If we already know that there's a team of workers that does a particular job well, we can just call that team and ask it to do the job for us. When we do that, the "input" and "output" nodes of that team will inform us what the team needs to do their job successfully.

## One-time set up

[Breadboard visual editor](https://breadboard-ai.web.app/) is a very flexible tool, and it can be used for many other purposes than just working with Agent Kit. To get the visual editor really honed in for the Agent Kit work, we will want to flip a few settings. To do so, click on the "gear" icon on the top right of the visual editor.

![Settings panel](/breadboard/static/images/agent-kit/settings-panel.png)

In the "General" section of the settings:

- Check _"Hide Embedded Board Selector When Empty"_. The embedded boards are super-cool, but they are a bit of an advanced use case.

- Check _"Hide Advanced Ports on Nodes"_. This will remove some of the options that aren't useful when playing with the Agent Kit.

- Check _"Show Node Shortcuts"_. This will make adding new workers super-easy by adding them as shortcuts at the left bottom part of the visual editor.

In the "Secrets" section:

- Create a "`GEMINI_KEY`" key and put your Gemini API key as the value. This value will be stored locally only and won't be shared with anyone other than the Gemini API.

![Secrets panel](/breadboard/static/images/agent-kit/secrets-panel.png)

Finally, in the "Inputs" section, create a "`model`" key and put in the name of the [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini#model-variations) to be used by the Workers. Otherwise, the workers will keep asking you for the model every time they want to use one. We recommend either `gemini-1.5-flash-latest` or `gemini-1.5-pro-latest`.

![Inputs panel](/breadboard/static/images/agent-kit/inputs-panel.png)

## Creating a Blank board

Let's see if we can build a simple team of Specialists that do something interesting for us.

First, we'll create a blank board by opening the left side panel and clicking on the "New Board" button. We will be asked to name the board. Let's name it something like `my-first-board.json`. All boards are stored as JSON files in the common Breadboard Graph Language (BGL) format.

![New Board](/breadboard/static/images/agent-kit/new-board.png)

## Adding a Specialist

As our next step, let's add a [Specialist](../#specialist) to this board. The easiest way to do this is by grabbing the little robot icon on the bottom left corner and dragging it onto the board.

![Adding a Specialist](/breadboard/static/images/agent-kit/add-specialist.png)

Yay! We did it.

Now, let's remove the existing edge connecting the `input` and `output` nodes. We can do this by clicking on the edge to highlight it and then pressing "Delete" (or "Backspace" for non-Mac users).

With the old edge deleted, let's connect input and output to the Specialist. Click and drag from the input's "Context" port to the Specialist's "Context In" port and then from the Specialist's "Context Out" port to the output's "Context" port.

![Wiring the Specialist](/breadboard/static/images/agent-kit/wire-specialist.png)

## Giving Specialist purpose

Congrats! We just made our first board with the Agent Kit. The only thing that's missing is something for Specialist to do. What purpose shall we give it?

Hmm... I am always on the lookout for a good book, and it's not always easy to find what I am looking for. So maybe, let's build a Librarian: an agent that helps us find the right book.

Let the education of the Specialist begin. First off, we will name it appropriately. Click on the node representing the Specialist and in the left (or bottom, if your Breadboard editor window portrait-shaped) panel, click on "Node Details". Then Type in "Librarian" as the node's title. You will also see that the title changes in the visual editor as well.

![Naming the Specialist](/breadboard/static/images/agent-kit/name-librarian.png)

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

At this point, our first board is complete. Let's give it a whirl.

To start the board, click "Run" in the Activity panel. The Activity panel will show the progress of the board's run, and the first thing we'll see is the request for input. This is exactly what we would expect, since the first node in the board is the "input". Let's type some subject that we're interested in. I love systems thinking and utopian sci fi, so that's what I'll enter.

![First Run Input](/breadboard/static/images/agent-kit/first-run-input.png)

After entering the text, click the "Continue" button. This will result in a flurry of activity in the Activity panel, and after a few seconds, the board will deliver our first output.

![First Run Output](/breadboard/static/images/agent-kit/first-run-output.png)

Cooool. We made a Librarian board. High fives all around. The results are good and the choices are classic.

Except...

After running this board with a few different inputs (it's easy -- just click "Run" again), we notice that the book recommendations are kind of meh. True, they are good books, but for an avid reader such as myself, it looks as if the board just cycles through "the usual suspects".

And that's understandable. Our current design relies on the Gemini's (the large language model that is behind the Specialist) parametric knowledge, and as such, is unlikely to produce fresh results or dig up forgotten gems for us.

To do that, we need to improve on our board design.

## Using tools with Specialist

Let's add another Specialist. We will name this Specialist the "Researcher" and give it a Persona of:

```prompt
You are a library researcher. Based on the provided topic,
formulate the query to call the Google Books API
to search for the right book for the user.
```

![Researcher persona](/breadboard/static/images/agent-kit/researcher-persona.png)

Alright! To get better results, we will give this Specialist the ability to call Google Books API.

To do so, click on "Create array" button under Tools, then select "Custom URL" from the dropdown and paste this URL into the box that pops up under the dropdown menu:

```text
https://breadboard.live/boards/@dimitri/tool-google-books.bgl.json
```

As we've learned earlier, boards are tools and this particular board calls the Google Books API with a specified query and returns a bunch of results.

> [!NOTE]
> Because boards are stored in the BGL format (which is just JSON), they are very easy to share and refer to. Just publish their BGL and give it a [stable URL](https://www.w3.org/Provider/Style/URI).

![Researcher persona](/breadboard/static/images/agent-kit/researcher-tools.png)

Now, let's wire them up. Delete the wire connecting the input to Librarian, and instead connect the input to the Researcher, and then wire Researcher to the Librarian. We just built our first workflow.

Both Specialists do only one task, and pass their work results along.

Speaking of which -- let's also teach the Librarian to look over the Researcher's work and consider it when providing recommendations. To do that, we'll tweak the Librarian's Persona as follows:

```prompt
You are an expert librarian. Given any topic,
and the raw book search results,
you can come up with a list of book recommendations.
```

If we try to run this board now, we'll find that it gives much more interesting results. It does particularly well with narrow or unusual topics. For instance, here's a result of running with the query of "educational books for children about butterfly migration". Where the lone Librarian would fall back onto "The Very Hungry Caterpillar" or hallucinate book titles, working together with Researcher, it produces genuinely useful results.

![Run result with Researcher](/breadboard/static/images/agent-kit/butterflies.png)

This is what makes Specialists so powerful. By themselves, they are pretty good, single mindedly focused on their particular task. When organized together and armed with tools, they become a lot more useful.

TODO:

- Add Interview Planner (Looper)

- Add Interviewer (Specialist)

- Add Interviewee (Human)

Final board:

{{ "/breadboard/static/boards/librarian.bgl.json" | board }}
