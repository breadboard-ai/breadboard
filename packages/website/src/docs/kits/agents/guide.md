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

### Human

TO DO:

- Draw Distinction between input/output and human

- Create a chain of specialist and human

### Looper

Unlike the Specialist that can be shaped to perform practically any task, Looper is a bit more pre-formed. Its purpose is to act as a planner and as the executor of that plan. A good way to think of Looper is as a project manager. Loopers plan and execute.

The word "Looper" is a bit odd, but there's a reason we went with it. The planning and execution process is enabled by creating loops in the board -- with the Looper orchestrating the loop. To manage their little projects, Loopers gotta loop.

This is why Looper has two output ports. One is the familiar "Context Out", which is how the final product of the loop is delivered. Think of it as the loop exit. The other one is named "Loop", and it is used to form the body of the loop. The typical pattern for using the Looper is that we wire workers that need to be part of this loop to that output port, and then wire their output back into the Looper's "Context In" port.

{{ "/breadboard/static/boards/looper-body.bgl.json" | board }}

The body of the loop may contain just one worker, or it may be comprised of many. As long as the last worker's output port is wired back to the Looper, Looper can do their job.

> [!NOTE]
> For the moment, the body of the loop can not contain another Looper. Loopers will get confused when nested.

#### How Looper works

How is Looper able to do their job? When a Looper first receives a task, it strategizes a bit, coming up with a plan to run the job. But how does it remember what the plan is and what is the next step in that plan?

The trick is that Looper maintains _memory_: it uses conversation context (remember that big folder that's being passed around?) to store the current state of the plan. Since the context continuously accumulates all work that is being done by the workers, all we need to do to help Looper remember is feed the latest conversation context back to it.

When the job returns back to Looper, it looks up this state, recalling what happened so far, and is then able to perform the next step in its plan.

> [!NOTE]
> A special role named `$metadata` is used to maintain Looper's memory. This role is filtered out before the conversation context is sent to the LLM, so that it doesn't confuse the model. If you inspect the conversation context, you'll notice that this role is used a lot by both Specialist and Looper to pass along additional information (aka metadata) between themselves.

#### Looper task

Unlike Specialists, Loopers do not have a customizable Persona. Think of it this way: they are born imbued with the "project manager" persona. All we need to give them is the Task: the job to manage.

As of today, Loopers can manage two kinds of jobs:

- A job that calls for the same task to repeat N times (or indefinitely).

- A job that calls for formulating consisting of a fixed sequence of steps (also known as "step-by-step job")

> [!NOTE]
> Looper is quite young and is still learning. It is very likely that it will learn of different kinds of job and become more capable over time.

The first kind of a job describes simple loops. A good example here is setting up a writer/critic loop. If we have a Writer Specialist and a Critic Specialist in such a loop, they will continuously improve their work by working with each other.

To tell Looper that the job calls for a such a plan, make sure that the task mentions "repeating" and the number of times to repeat, like:

```prompt
Repeat 3 times
```

The second kind suits jobs that require a plan and we want the Looper to come with such a plan. Here's one example:

```prompt
Chapter-by-chapter, write a book based on the supplied outline.
```

If give a ten-chapter book outline to Looper and configure it with this task, it will recognize that this is a step-by-step job, then examine the outline, and come up with a plan that will include ten steps, one for each chapter. It will then ensure that the Specialists inside of the loop body are asked to write each chapter, ten times.

We can also give it more broad Tasks to formulate plans. For instance:

```prompt
Step by step, write lyrics for a modern hit song
based on the source material, from developing themes
to brainstorming metaphors, to writing the storyline,
to creating catchy hooks, with the final task of
writing the lyrics.
```

In the Task above, we don't even tell it exact steps. We trust Looper and delegate. They love it when we give them agency.

As long as there's a hint at formulating a plan with steps in the Task, Loopers will recognize the "step-by-step job" kind and act accordingly.

#### Looper and other workers

Because Looper does the planning, workers inside the body loop only see one step of the plan at each iteration. They aren't aware of the big picture. Doing so allows them to focus on their task at hand.

For simple repetition jobs, it's fairly straightforward. We just treat the workers as if they are doing only one step of the iteration.

For step-by-step jobs, we need to add a bit more flexibility to the workers. We need to expect that Looper might send varying kinds of tasks to them.

For instance, when creating a Persona for a Specialist inside of the loop body, we craft it in a way that helps Specialist perform any of the potential tasks within the loop. A good practice is to tell the Specialist that it can wear many hats. Here's a sketch for a Specialist persona that matches the lyrics-crafting task above (some details of the prompt elided for brevity):

```prompt
You are a multi-talented writer. You can wear many hats.
You are also famous for collaborating, so when asked
to do a particular task, you do just that task,
and leave space for others to do their jobs.

When asked to develop a theme for a song,
you know exactly what to do.
(remind LLM how to develop song themes)

When asked to write copy, you are set.
You are a brilliant copywriter.
(remind LLM how to be a great copy writer)

When asked to work on hooks, you've got it
(remind LLM how the best hooks are made)

When asked to write the song lyrics,
(remind LLM how to write the best song lyrics)

...

```

TO DO:

- Create a simple looper with the specialist

### Joiner

TO DO:

- Describe how joiner works

- Create a graph that joins contexts.
