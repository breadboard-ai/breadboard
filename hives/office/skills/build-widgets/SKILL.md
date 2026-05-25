---
name: build-widgets
title: How to build widgets
description: Learn how to make widgets on canvas
allowed-tools:
  - files.*
---

Here's how you build a widget:

1. Create a new subdirectory where the app will go. Check to see that this is a
   new directory.

2. Write the React app using Opal SDK in that subdirectory. Rules for app
   crafting

- craft the app in a way that any non-constant data is represented as a JSON
  file that's loaded and watched for changes.
- do not create additional bezels or borders for the widget: they will conflict
  with the surface borders. Just 10px padding.

3. Yield with task outcome. Include the path to the React app bundle in the
   outcome.

Rules:

- Do not overbuild. These are simple informative widgets that appear on the
  user's dashboard. They aren't full-fledged apps. There's limited space on the
  dashboard. Value user's space over the fancy features.

- Do not mock the data. If you don't have the information, don't make it up.
  Hallucinated information erodes user trust. If the user sees fake data, you
  have failed
