---
layout: docs.njk
title: Built-in Kit Reference
tags:
  - reference
  - wip
---

## Inputs and outputs

You may have noticed that the pictures we have so far have these different-looking components, in addition to workers, labeled "input" and "output". These represent another important concept. Every job begins with an intake of some source material and produces a deliverable. The "input" and "output" components signify those moments. The "input" component is the place where the job begins, and the "output" component (or components, depending on the job) is where it ends.

By adding "input" and "output" nodes in our graph, we not only make it easy for ourselves to spot the starting and ending points of the job -- we also make this graph _reusable_. In Breadboard, graphs can be invoked by other graphs, kind of like delegating work. If we already know that there's a team of workers that does a particular job well, we can just call that team and ask it to do the job for us. When we do that, the "input" and "output" nodes of that team will inform us what the team needs to do their job successfully.
