---
layout: docs.njk
title: What the heck is Agent Kit?
tags:
  - guide
---

The agent kit is a collection of Breadboard nodes designed to help build **asynchronous, semi-autonomous agents**. That's a mouthful, so let's break it down into parts, starting from the end:

- _agents_, at least in this particular sense, points at a broad variety of LLM-powered experiences designed to perform some particular tasks on behalf of the user.

- _semi-autonomous_ means that our agents perform tasks with some human help, but mostly by themselves.

- _asynchronous_ signifies that these tasks may take a while to perform. They may translate into multiple LLM calls and involve calling external tools. In contrast with chat-based agents (synchronous), we don't expect to hear back right away.

## Key concepts

All nodes in agent kit all have a certain way of fitting together. Like parts of a larger Voltron body, they are designed to clip together easily to build interesting agents. Let's see if we can distill it with a few concepts.

### Conversation context

Conversation context is likely the most important concept in the Agent Kit. All Agent Kit nodes speak in terms of conversation context as their input and output. It is the lingua franca of the kit.

A good way to think of context is as a job folio of sorts that collaborators pass from one to another, contributing to it along the way.

![Context in, context out](/breadboard/static/images/agent-kit/context-in-out.png)

Back in the day, creative agencies had these large folders that contained all the project artifacts, and the name of the client printed on the front. If I had this folder on your desk, that meant that I am working on that project, looking through things that were done already, and adding my own work to it, and passing the folder along to the next person when I am done. Think of the context as such a folder.

If we trace the path that this job folio travels from one collaborator to another, we can capture the collaboration process as a graph.

![Context flow as a graph](/breadboard/static/images/agent-kit/context-flow-as-a-graph.png)

With Agent Kit, we connect nodes with wires to plot the path of the context. The collaborators know what to do with the context, how to ruffle through it, find what they need to do their task, how to add to it, and how to pass it along.

![Context in, context out, zoomed in](/breadboard/static/images/agent-kit/context-in-out-2.png)

> [!NOTE]
> Under the covers, what flows over the wires is the multi-turn LLM conversation context (specifically, a dialect of Gemini API's [Content](https://ai.google.dev/api/rest/v1beta/Content) list). Since most modern LLMs support multi-turn conversations, the conversation sequence creates a convenient way to represent the history of the work being done.

### Workers and tasks

Each node in the Agent Kit is a kind of worker. Workers are not agents themselves (though they probably dream of becoming fully-fledged agents one day), but rather composite bits out of which an agent can be created.

Every worker is meant to do one task, and do it well. When we add workers, we imbue them with purpose and expertise, and from that point on, we give them agency to perform the task. When they receive context, they do this task, and then pass it along to the next worker. _One worker, one task_.

In this way, using the Agent Kit is very much like **designing a process for a team of workers**. We break a job into a list of discrete tasks, then connect them into a process diagram.

Depending on the job we want the team to do, the way we organize workers might be different. When job requires tasks performed in a sequence, the workers will likely form something of an assembly line.

![Workers forming an assembly line](/breadboard/static/images/agent-kit/assembly-line.png)

When the job calls for an iterative process, a visual representation of the process will likely contain loops.

![Workers forming an iterative loop](/breadboard/static/images/agent-kit/iterative-process.png)

Many jobs will contain a mix of both, where there are both parts of the process that are assembly-line like and the ones that have loops. We may even have parallel assembly lines with loops in them, and one large loop that rules them all. It all depends on what we're trying to accomplish.

> [!NOTE]
> Under the covers, a worker is a single call to an LLM. Some workers may call LLM more than once, but only in situations when the first call returned an invalid response.

### Inputs and outputs

You may have noticed that the pictures we have so far have these different-looking nodes, in addition to workers, labeled "input" and "output". These represent another important concept. Every job begins with an intake of some source material and produces a deliverable. The "input" and "output" nodes signify those moments. The "input" node is the place where the job begins, and the "output" node (or nodes, depending on the job) is where it ends.

By adding "input" and "output" nodes in our graph, we not only make it easy for ourselves to spot the starting and ending points of the job -- we also make this graph _reusable_. In Breadboard, graphs can be invoked by other graphs, kind of like delegating work. If we already know that there's a team of workers that does a particular job well, we can just call that team and ask it to do the job for us. When we do that, the "input" and "output" nodes of that team will inform us what the team needs to do their job successfully.

## Into the groove

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

We are now ready to get introduced to the workers.

## Getting to know the workers

Just like with any team, it seems important to get acquainted with the peeps with whom we will collaborate.

### Specialist

The Specialist is the most versatile worker in the Agent Kit. It can do many things, and our job is to focus the Specialist on the task we need it to perform. We have the following three ways to imbue a Specialist with purpose:

#### Specialist Persona

We can give Specialist a "Persona". This is a required part of configuring the Specialist, since it gives it the worker a sense of what it is about.

![Specialist Persona](/breadboard/static/images/agent-kit/specialist-persona.png)

> [!NOTE]
> Under the covers, the "Persona" field populates the [system instruction](https://ai.google.dev/gemini-api/docs/system-instructions) for the LLM call.

#### Specialist Task

We can give Specialist a "Task". This field is optional and can be very handy for specifying a particular task that we'd like this worker to be focused on.

![Specialist Task](/breadboard/static/images/agent-kit/specialist-task.png)

> [!NOTE]
> Under the covers, the "Task" field populates the "user" turn of the multi-turn conversation.

Sometimes, it might take some thinking to decide what does into the "Persona" and what goes into the "Task" field. Here are a few rules of thumbs that we've found useful:

- "You are" goes into Persona, "You do" goes into Task. When configuring a worker, it helps to split what they are to do from who they are. The "do" part may change from task to task, while the "are" part stays more or less constant.

- Inform the next worker. Unlike Persona, tasks become part of the conversation context, which means that they help the next worker figure out why the previous worker did all that work.

- Leave the task out if it comes with the conversation context. In some cases, (see [Looper](#looper)), the previous worker will tell the next worker what their task will be. In these situations, leave that worker's task blank.

#### Specialist Tools

Finally, we can give Specialist "Tools" to work with. Tools are an optional field and allow the worker to perform tasks that require calling other APIs or perform computations that aren't part of the typical LLM capabilities.

![Specialist Tools](/breadboard/static/images/agent-kit/specialist-tools.png)

In Breadboard land, tools are boards, and boards are tools. For instance, our colleague might build a [board](https://breadboard-ai.web.app/?board=%2Fgraphs%2Fnager.date%2Fpublic-holidays.json) that calls an API that computes public holidays for a given locale and returns the results. Once that board exists, we can use it as a tool for the Specialist.

All you need is a URL for the board:

![Public Holidays Tool in Specialist](/breadboard/static/images/agent-kit/specialist-tool-custom.png)

Once the tool is provided, the Specialist will invoke it whenever the task calls for it, and return the tool's results as part of the conversation context.

> [!NOTE]
> Under the covers, specialist tools are powered by the [function calling](https://ai.google.dev/gemini-api/docs/function-calling) capability of the LLM. Combined with Breadboard's flexible [composition system](breadboard/docs/too-long/#graph-based-composition-system), the LLM's decision to call a function is translated into an invocation of a board, and the results of this invocation are appended to the conversation context with a special "tool" role.

#### Using Specialist

Let's see if we can build a simple team of Specialists that do something interesting for us.

First, we'll create a blank board by opening the left side panel and clicking on the "New Board" button. We will be asked to name the board. Let's name it something like `my-first-board.json`. All boards are stored as JSON files in the common Breadboard Graph Language (BGL) format.

![New Board](/breadboard/static/images/agent-kit/new-board.png)

As our next step, let's add a Specialist to this board. The easiest way to do this is by grabbing the little robot icon on the bottom left corner and dragging it onto the board.

![Adding a Specialist](/breadboard/static/images/agent-kit/add-specialist.png)

Yay! We did it.

Now, let's remove the existing edge connecting the `input` and `output` nodes. We can do this by clicking on the edge to highlight it and then pressing "Delete" (or "Backspace" for non-Mac users).

With the old edge deleted, let's connect input and output to the Specialist. Click and drag from the input's "Context" port to the Specialist's "Context In" port and then from the Specialist's "Context Out" port to the output's "Context" port.

![Wiring the Specialist](/breadboard/static/images/agent-kit/wire-specialist.png)

Congrats! We built our first board with the Agent Kit. The only thing that's missing is something for Specialist to do. What purpose shall we give it?

Hmm... I am always on the lookout for a good book, and it's not always easy to find what I am looking for. So maybe, let's build a Librarian: an agent that helps us find the right book.

Let the education of the Specialist begin. First off, we will name it appropriately. Click on the node representing the Specialist and in the left (or bottom, if your Breadboard editor window portrait-shaped) panel, click on "Node Details". Then Type in "Librarian" as the node's title. You will also see that the title changes in the visual editor as well.

![Naming the Specialist](/breadboard/static/images/agent-kit/name-librarian.png)

Moving on to the Persona, let's type in something like this:

> You are an expert librarian. Given any topic, you can come up with a list of book recommendations.

As a Task, let's put:

> Come up with a list of 5-7 recommendations. Reply in markdown.

TO DO:

- Run

- Chain specialists together

- Tool-calling: create a specialist that does something useful with a tool

### Human

TO DO:

- Draw Distinction between input/output and human

- Create a chain of specialist and human

### Looper

TO DO:

- Describe the concept of squishy brain and hard brain of Looper

- Describe plan making types

- Create a simple looper with the specialist

### Joiner

TO DO:

- Describe how joiner works

- Create a graph that joins contexts.
