---
layout: docs.liquid
title: Introduction
tags:
  - visualeditor
date: 2020-01-01 # First in the list
---

The [Visual Editor](https://breadboard-ai.web.app/) is one of the easiest ways to get going with Breadboard. In this section we'll run through the features it has, and how you can use them to create and share your boards.

> [!NOTE]
> In this guide we'll refer to the hosted version of the Breadboard Visual Editor, which you can find at [https://breadboard-ai.web.app/](https://breadboard-ai.web.app/). The Visual Editor is a standalone, open source web app, which means you can also host your own instance of it elsewhere if you prefer.

When we first launch the Visual Editor we are greeted with this view.

![The initial view of the Breadboard Visual Editor](/breadboard/static/images/using-the-visual-editor/initial-view.png)

At the top we have the navigation bar, which has a menu icon in the top left corner that takes us to our [Providers](#providers), the place where we can access boards that we, and others, have created.

In the top right corner we find the **undo**, **redo**, and **Preview** buttons, as well as a link to the [overflow menu](#the-overflow-menu).

![The undo, redo, and show preview buttons](/breadboard/static/images/using-the-visual-editor/top-menu.png)

The undo and redo buttons are there for us to step back and forth through changes we make to our boards, and the Preview button allows us to run the board with less debugging information than we get by default in the Visual Editor's [Activity Panel](#the-activity-panel).

> [!TIP]
> You can use `Cmd`/`Ctrl` + `Z` and `Cmd`/`Ctrl` + `Shift` + `Z` to undo and redo respectively.

On the right hand side we find the details pane, which changes depending on what we have selected. By default the right hand pane shows us the Board information, the [Activity Panel](#the-activity-panel) (where we will see the board's inputs and outputs during a run), as well as buttons to [start and stop a board](#starting-and-stopping-a-board).

![The right hand side of the Visual Editor, showing the Board information, Activity Panel, and buttons for starting and stopping a board](/breadboard/static/images/using-the-visual-editor/right-hand-side.png)

> [!NOTE]
> The Visual Editor is responsive, so if your browser has a portrait aspect ratio rather than a landscape one, you will find that the right hand panels are instead laid out at the bottom.

This right hand pane is resizable; we can make larger or smaller by clicking and dragging on its left hand edge.

## The Welcome Pane

Finally, in the middle we have the **Welcome Pane** which shows us the most recent boards we've opened, links to some guides and documentation, and a button where we can **create a new board**. Later, when we open a board, this area will show the board's layout and we will be able to drag components and wires around there instead.

![The welcome pane in the Visual Editor](/breadboard/static/images/using-the-visual-editor/welcome-pane.png)

This **Welcome Pane** is shown whenever we first visit the Visual Editor, or whenever we close a board.

> [!TIP]
> If you find a bug in the Visual Editor there is a handy link in the bottom left corner you can click on to file a bug report 🐛.

[Next: Boards and Providers](./boards-and-providers/)
