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

> [!TIP]
> If this is your first time playing with Breadboard, this guide is a good starting point. It is intentionally a bit more verbose, written with the hope that a Breadboard novice can go through it and get a good sense of how to build boards.

The finished board is here and you're welcome to play with it first. When you run it for the first time, it will ask you for the Gemini API Key. Get it at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

> [!NOTE]
> You might have a reasonable question: "Why does Breadboard ask me for an API key?" One of the key tenets of this project is to allow makers quickly connect to various interesting models and other APIs. To do that, Breadboard has a pretty robust system for managing _secrets_: valuable pieces of data help you connect to them. To balance convenience with flexibility, Breadboard Visual Editor stores these keys in your local browser store.

{{ "/breadboard/static/boards/librarian/final.bgl.json" | board }}

This board uses the Agent Kit, a collection of nodes designed to help build asynchronous, semi-autonomous agents. You can read more about it in the [Agent Kit Reference](/breadboard/docs/kits/agents/). Additionally, we'll use the built-in "input" and "output" nodes. These are described in the [Built-in Kit Reference](/breadboard/docs/reference/kits/built-in/).

To build this board, we will use the Breadboard Visual Editor, which is a tool for rapid prototyping AI systems. You can learn more about about all the different features and capabilities of Breadboard Visual Editor in the [Visual Editor Reference](/breadboard/docs/reference/visual-editor/).

> [!TIP]
> At any point in the tutorial, you can click "See in Visual Editor" link at the left bottom corner of the board diagram. This will open the Breadboard Visual Editor and load the board. So if you're not feeling like typing and doing all the dragging and dropping of nodes, you can just follow along by opening each link.

## Step 1: Create a Blank board

First, we'll create a [blank board](/breadboard/docs/reference/visual-editor/#creating-a-new-board). Let's name it something like `my-librarian.bgl.json` and give it a proper title and description, like "My Librarian" and "A simple agent that helps me find interesting books".

{{ "/breadboard/static/boards/librarian/1.bgl.json" | board }}

## Step 2: Add Summarizer

As our next step, let's add a Summarizer [Specialist](../#specialist) to this board. The easiest way to do this is by grabbing the little robot icon on the bottom left corner and dragging it onto the board.

![Breadboard Node Selector](/breadboard/static/images/agent-kit/node-selector.png)

Now, let's remove the existing edge connecting the `input` and `output` nodes. We can do this by clicking on the edge to highlight it and then pressing "Delete" (or "Backspace" for non-Mac users).

With the old edge deleted, let's connect input and output to the Specialist. Click and drag from the input's "Context" port to the Specialist's "Context In" port and then from the Specialist's "Context Out" port to the output's "Context" port.

{{ "/breadboard/static/boards/librarian/2.bgl.json" | board }}

We will not invest a tiny bit of effort to educate our Specialist and imbue it with purpose.

> [!NOTE]
> With Visual Breadboard, it's super-easy to create and connect Specialists. We wanted to make sure that you can focus on the most interesting -- and challenging! -- part: teaching Specialists to do their work well.

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

## Step 3: Add Researcher

Let's add another Specialist. We will name this Specialist the "Researcher" and give it a Persona of:

```prompt
You are a library researcher. Based on the provided topic,
formulate the query to call the Google Books API
to search for the right book for the user.
```

To get better results, we will give this Specialist the ability to call Google Books API.

To do so, click on "Create array" button under Tools, then select "Custom URL" from the dropdown and paste this URL into the box that pops up under the dropdown menu:

```text
https://breadboard-ai.github.io/breadboard/static/boards/librarian/tool-google-books.bgl.json
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

## Step 4: Add Interview Planner

What we have is pretty good, but I feel like it's missing something. Often, I don't actually know exactly what I am looking for, and it sure would be helpful to have my Librarian ask me a few questions around the topic of my interest to really hone in on the right book.

Let's add a brief interview process in front of the Researcher, and then give the interview results to it.

To do this, we will need to create a loop in our board: a cycle in which the interviewer repeatedly asks us a series of questions. This loop is a very common pattern when working with the Agent Kit, and it has a special node called [Looper](/breadboard/docs/kits/agents/#looper) to make loops quickly.

Looper has a distinctive "cycle" icon. Just like we did with the Specialists, let's drag a Looper into the board and name it "Interview Planner". The purpose of this particular Looper will be to plan and conduct the book interview described above.

{{ "/breadboard/static/boards/librarian/add-interview-planner.bgl.json" | board }}

First thing we'll notice is that, unlike Specialist, Looper has two output ports. The "Context Out" port sends the conversation context when the Looper completed all of the steps of its plan. The "Loop" port sends the context repeatedly for each step of the plan.

Second difference will become evident when we click on the Looper to configure it. It has no Persona configuration field. Instead, there's only Task. This is because the Persona of the Looper is pre-defined, honed to create robust plans based on the tasks we give it. There's also no Tools configuration field. Looper is very focused on planning and the management of the plan. It has no time for tools.

For our Interview Planner's Task, let's give it something like:

```markdown
Based on the initial topic, come up with the themes for
a 3-5 question interview to collect just enough information
to look for an interesting book in the library.
```

Then, let's wire it into the graph: insert it between the Input node and the Researcher Node, the same way we wired the Researcher earlier.

{{ "/breadboard/static/boards/librarian/wire-interview-planner.bgl.json" | board }}

## Step 5: Add Interviewer

Now that we have a Interview Planner to come up with an interview plan, we will add the Interviewer to the board. The Interviewer will be responsible for formulating the questions for the interview and reacting to user feedback. This is the job for -- you guessed it -- Specialist!

Drag in another Specialist and name it "Interviewer". Here's the Persona for our Interviewer:

```markdown
You are an expert researcher, whose job it is to
interview the user to collect information about
the kind of book they want. Based on the theme
provided and incorporating the history of the interview
so far, offer a question that allows the user to
easily pick or quickly type an answer.
```

We don't need to put anything into Task -- let's let the Interview Planner provide it. To do that, wire the "Loop" port of the Interview Planner into the "Context in" port of our Interviewer.

{{ "/breadboard/static/boards/librarian/add-interviewer.bgl.json" | board }}

## Step 6: Put Human in the loop

As our final node in this board, let's add Human. This node represents the user in the overall flow of the board.

Human node serves as a way to yield control back to the user of the board. When Breadboard encounters it, it pauses execution, shows intermediate results to the user, and asks the user to react to them. This is exactly what we need in our interview: show the question and wait for the user to answer it.

We'll name this node "Interviewee" and wire the "Context out" port of the Interviewer to its "Context in" port, and then close the loop by wiring Interviewee's "Context out" back into Interview Planner's "Context in".

{{ "/breadboard/static/boards/librarian/add-interviewee.bgl.json" | board }}

When we run this board, we'll see that its behavior has changed: instead of asking us just one question at the start, it keeps chatting with us, helping us zero in on the kind of book we're looking for -- and produces even more interesting results than before.

> [!NOTE]
> This particular combination of Interview Planner / Interviewer / Interviewee is an [AI pattern](https://glazkov.com/2023/08/28/ai-patterns-and-breadboard/): it's a fairly reliable method to conduct a quick interview for any purpose. For instance, shown below another board, which chats with the user about a book idea and then creates a detailed outline from it. AI Patterns are the whole point and spirit of Breadboard: to give you space to joyfully uncover interesting AI patterns, as well as reuse, and remix existing ones.

{{ "/breadboard/static/boards/librarian/book-outline-interviewer.bgl.json" | board }}

## Step 7: Put on finishing touches

- Multiple API calls

- Book pictures

- Adding comments

Final board:

{{ "/breadboard/static/boards/librarian/final.bgl.json" | board }}
