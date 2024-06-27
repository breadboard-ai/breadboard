---
layout: docs.njk
title: Agent Kit
tags:
  - kits
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/agent-kit/src/nodes/" %}

The Agent kit is a collection of Breadboard nodes designed to help build **asynchronous, semi-autonomous agents**. That's a mouthful, so let's break it down into parts, starting from the end:

- _agents_, at least in this particular sense, points at a broad variety of LLM-powered experiences designed to perform some particular tasks on behalf of the user.

- _semi-autonomous_ means that our agents perform tasks with some human help, but mostly by themselves. As a loose analogy, with this kit, we are able to create functional organizations that include both human and synthetic members.

- _asynchronous_ signifies that these tasks may take a while to perform. They may translate into multiple LLM calls and involve calling external tools. In contrast with chat-based agents (synchronous), we don't expect to hear back right away. Agent Kit is best suited for jobs where the time constraints aren't firm, and taking it minutes or hours to arrive at the solution is perfectly acceptable.

> [!WARNING]
>
> This kit is in active development and isn't yet fully there. Things may shift. Construction debris may be found in your cookies.

## Overview

All nodes in the Agent Kit all have a certain way of fitting together. Like parts of a larger [combiner body](https://tfwiki.net/wiki/Combiner), they are designed to clip together easily to build interesting agents. Let's see if we can distill it with a few concepts.

### Conversation context

Conversation context is likely the most important concept in the Agent Kit. All Agent Kit nodes speak in terms of conversation context as their input and output. It is the lingua franca of the kit.

A good way to think of context is as a job folio of sorts that collaborators pass from one to another, contributing to it along the way.

![Context in, context out](/breadboard/static/images/agent-kit/context-in-out.png)

> [!TIP]
> Back in the day, creative agencies had these large folders that contained all the project artifacts, and the name of the client printed on the front. If I had this folder on your desk, that meant that I am working on that project, looking through things that were done already, and adding my own work to it, and passing the folder along to the next person when I am done. Think of the context as such a folder.

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

Many jobs will contain a mix of both, where there are both parts of the process that are assembly-line like and the ones that have loops. We may even have parallel assembly lines with loops in them. It all depends on what we're trying to accomplish.

> [!NOTE]
> Under the covers, a worker typically represents a single call to an LLM. Some workers may call LLM more than once, but only in situations when the first call returned an invalid response. Some workers are more mechanical and don't call LLM at all.

There are currently four different kinds of workers in the Kit: **Specialist**, **Looper**, **Human**, and **Joiner**.

## Specialist

A Specialist is the most versatile worker in the Agent Kit. It can do many things, and our job is to focus Specialist on the task we need it to perform. We have the following three ways to imbue a Specialist with purpose:

### Specialist Persona

We can give Specialist a "Persona". This is a required part of configuring Specialist, since it gives it the worker a sense of what it is about.

![Specialist Persona](/breadboard/static/images/agent-kit/specialist-persona.png)

> [!NOTE]
> Under the covers, the "Persona" field populates the [system instruction](https://ai.google.dev/gemini-api/docs/system-instructions) for the LLM call.

### Specialist Task

We can give Specialist a "Task". This field is optional and can be very handy for specifying a particular task that we'd like this worker to be focused on.

![Specialist Task](/breadboard/static/images/agent-kit/specialist-task.png)

> [!NOTE]
> Under the covers, the "Task" field populates the "user" turn of the multi-turn conversation.

Sometimes, it might take some thinking to decide what does into the "Persona" and what goes into the "Task" field. Here are a few rules of thumbs that we've found useful:

- "You are" goes into Persona, "You do" goes into Task. When configuring a worker, it helps to split what they are to do from who they are. The "do" part may change from task to task, while the "are" part stays more or less constant.

- Inform the next worker. Unlike Persona, tasks become part of the conversation context, which means that they help the next worker figure out why the previous worker did all that work.

- Leave the task out if it comes with the conversation context. In some cases, (see [Looper](#looper)), the previous worker will tell the next worker what their task will be. In these situations, leave that worker's task blank.

### Specialist Tools

Finally, we can give Specialist "Tools" to work with. Tools are an optional field and allow the worker to perform tasks that require calling other APIs or perform computations that aren't part of the typical LLM capabilities.

![Specialist Tools](/breadboard/static/images/agent-kit/specialist-tools.png)

In Breadboard land, tools are boards, and boards are tools. For instance, our colleague might build a [board](https://breadboard-ai.web.app/?board=%2Fgraphs%2Fnager.date%2Fpublic-holidays.json) that calls an API that computes public holidays for a given locale and returns the results. Once that board exists, we can use it as a tool for the Specialist.

All you need is a URL for the board:

![Public Holidays Tool in Specialist](/breadboard/static/images/agent-kit/specialist-tool-custom.png)

Once the tool is provided, the Specialist will invoke it whenever the task calls for it, and return the tool's results as part of the conversation context.

> [!NOTE]
> Under the covers, specialist tools are powered by the [function calling](https://ai.google.dev/gemini-api/docs/function-calling) capability of the LLM. Combined with Breadboard's flexible [composition system](breadboard/docs/too-long/#graph-based-composition-system), the LLM's decision to call a function is translated into an invocation of a board, and the results of this invocation are appended to the conversation context with a special "tool" role.

## Looper

Unlike the Specialist that can be shaped to perform practically any task, Looper is a bit more pre-formed. Its purpose is to act as a planner and as the executor of that plan. A good way to think of Looper is as a project manager. Loopers plan and execute.

The word "Looper" is a bit odd, but there's a reason we went with it. The planning and execution process is enabled by creating loops in the board -- with the Looper orchestrating the loop. To manage their little projects, Loopers gotta loop.

This is why Looper has two output ports. One is the familiar "Context Out", which is how the final product of the loop is delivered. Think of it as the loop exit. The other one is named "Loop", and it is used to form the body of the loop. The typical pattern for using the Looper is that we wire workers that need to be part of this loop to that output port, and then wire their output back into the Looper's "Context In" port.

{{ "/breadboard/static/boards/looper-body.bgl.json" | board }}

The body of the loop may contain just one worker, or it may be comprised of many. As long as the last worker's output port is wired back to the Looper, Looper can do their job.

> [!NOTE]
> For the moment, the body of the loop can not contain another Looper. Loopers will get confused when nested.

### How Looper works

How is Looper able to do their job? When a Looper first receives a task, it strategizes a bit, coming up with a plan to run the job. But how does it remember what the plan is and what is the next step in that plan?

The trick is that Looper maintains _memory_: it uses conversation context (remember that big folder that's being passed around?) to store the current state of the plan. Since the context continuously accumulates all work that is being done by the workers, all we need to do to help Looper remember is feed the latest conversation context back to it.

When the job returns back to Looper, it looks up this state, recalling what happened so far, and is then able to perform the next step in its plan.

> [!NOTE]
> A special role named `$metadata` is used to maintain Looper's memory. This role is filtered out before the conversation context is sent to the LLM, so that it doesn't confuse the model. If you inspect the conversation context, you'll notice that this role is used a lot by both Specialist and Looper to pass along additional information (aka metadata) between themselves.

### Looper's task

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

### Looper and other workers

Because Looper does the planning, workers inside the body loop only see one step of the plan at each iteration. They aren't aware of the big picture. Doing so allows them to focus on their task at hand.

For simple repetition jobs, it's fairly straightforward. We just treat the workers as if they are doing only one step of the iteration.

For step-by-step jobs, we need to add a bit more flexibility to the workers. We need to expect that Looper might send varying kinds of tasks to them.

For instance, when creating a Persona for a Specialist inside of the loop body, we craft it in a way that helps Specialist perform any of the potential tasks within the loop. A good practice is to tell the Specialist that it can play many different roles, and adapt based on the task. Here's a sketch for a Specialist persona that matches the lyrics-crafting task above (some details of the prompt elided for brevity):

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

By giving a Specialist such range of agency, we prepare it better for interacting with Looper in more interesting ways.

> [!TIP]
> The most important part about using Agent Kit is that it's all about experimentation. Treat the guidelines above as loose suggestions and fodder for your own ideas. Play with workers. Give them different tasks and personas. Connect them in different ways. See what happens -- and delight in unexpected discoveries.

## Human

Human is a way to insert a real person into our team of our so-far synthetic workers. Such a person may steer the work with comments, accept or reject work, collaborating with the synthetic workers.

When placed into the flow of work, Human shows the intermediate output and asks the user for input in response to this output.

{{ "/breadboard/static/boards/human-example.bgl.json" | board }}

## Joiner

While not powered by an LLM or representing a real person, Joiner is an essential part of any team of workers. Depending on how it is configured, Joiner acts a helper that, respectively, joins or merges conversation contexts.

{{ "/breadboard/static/boards/joiner-example.bgl.json" | board }}

When the flow of work splits across multiple workers, we can rely on Joiner to bring it all together.

When first added to the board, Joiner has no incoming ports: we have to explicitly inform it about all the context we'd like to join. To do so, use the "ad hoc" wiring technique in Breadboard. Drag a wire from each outgoing port we want to be joined into the center of the Joiner, then release. A small dialog box will pop up asking to name the port. Give it an informative name (can only contain lowercase alphanumeric characters, dashes, or numbers) and the wire will appear.

{{ "/breadboard/static/boards/new-joiner-port.bgl.json" | board }}

Joiner has one configuration option, a checkbox on whether or not to merge the last items of all incoming context into one.

![Joiner Merge option](/breadboard/static/images/agent-kit/joiner-merge.png)

When that checkbox is not checked, joiner will take all of the incoming conversation contexts and just string them together into one mega conversation context.

When the checkbox is checked, it will only take the last item of each conversation context and turn them into a new conversation context that contains only one item, merging them as parts of that item.

In either case, the order of items (or contexts) is determined by the alphabetical sort of the incoming ports for the Joiner.

> [!TIP]
> It's a good practice to name ports in a way that makes the order evident. Like in the example above, the ports are named "a-picture", "b-voice", and "c-text" to ensure that the picture goes first, followed by voice and then text.
