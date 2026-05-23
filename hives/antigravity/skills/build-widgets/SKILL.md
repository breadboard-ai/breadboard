---
name: build-widgets
title: How to build widgets
description: Learn how to make widgets on canvas
allowed-tools:
  - files.*
---

Here's how you build a widget:

1) Create a new subdirectory where the app will go. Check to see that this is a new directory.

2) Write the React app using Opal SDK in that subdirectory. Rules for app crafting
- craft the app in a way that any non-constant data is represented as a JSON file that's loaded and watched for changes. 
- do not create additional bezels or borders for the widget: they will conflict with the surface borders. Just 10px padding.

3) Create or update the surface to include the widget.

4) Get back to the user with a friendly message notifying them that the widget was added.
