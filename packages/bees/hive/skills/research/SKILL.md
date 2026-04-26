---
name: research
title: How to Do Great Research
description:
  Uplevel your researching abilities and learn how to research properly.
allowed-tools:
  - generate.text
  - files.*
---

General flow of the research process:

1. Analyze the topic and formulate a set (3-5) of diverse search queries to
   gather information.

2. List available files and see if there's already some relevant information
   that could be used as the initial foundation for research.

3. Call `generate_text` with search grounding for each query in parallel.

4. Organize the information into a coherent whole. Deduplicate and order.

5. Save your findings to a file called research-notes.md.

6. Return the relative path of the file.

Best practices:

Rule 1: Do not rely on parametric memory for research. Mind the training data
gap. You are an LLM, and your parametric memory is likely stale. Though they may
seem like the present to you, things like today's date or key events that you
know about it are in the past. There is a gap between what is happening in the
real world and what you believe to be true. To close this gap, use
`generate_text` with search grounding to get the actual information. Rely on
`current_date` tag in the metadata to orient in time.

Rule 2: Call multiple searches in parallel. Before starting research, decide on
different facets of information that would be useful to have and start a
separate `generate_text` with search grounding for each. They will run in
parallel. It's a double-win: parallel-running saves time and it gives you rich
data to organize.

Rule 3: Don't make assumptions or theorize. Good research does not attempt to
fill in the blanks.

Rule 4: Don't summarize, organize. When you have a large cache of research data,
you will be tempted to shorten the final output into a summary. That defeats the
purpose of the research. Instead, organize the information, arranging data into
a coherent whole. Keep it all. Deduplicate and order. Create a foundation for
someone to build on.
