---
layout: docs.liquid
title: Boards and Providers
tags:
  - visualeditor
date: 2020-01-02 # Second in the list
---

**Boards** are runnable containers we use for our components, expressed as a graph. We primarily manage boards in the Visual Editor using **Providers**.

A **Provider** is a storage place for Boards. By default Breadboard comes with two Providers: a read-only one which contains a selection of example boards, and a writable one, backed by the browser's internal storage, where we can store our own boards.

## Providers

If we click on the menu icon in the top left corner a board selection menu will slide out. In the top right corner of the menu there is a button we can use to **create a new board**, and beneath it a field where we can **search for a board** within the current Provider.

![The side menu in the Visual Editor](/breadboard/static/images/using-the-visual-editor/side-menu.png)

> [!NOTE]
> The Visual Editor does not store any data remotely by default. It is possible to add a Board Server in the Providers, which allows you to work with remote boards as well as local ones.

### Loading Boards

To load a board click on its title in the side menu. Its name will then be highlighted in bold, and the main view will show the board's components and wires.

![The side menu showing a selected item](/breadboard/static/images/using-the-visual-editor/selected-item.png)

If the board we want to load is in a different Provider to the one we have selected we can use the menu above the board list to switch to it, and then choose the board from its list.

### Saving Boards

As mentioned earlier, some Providers are read-only, and others allow us to update boards. For example, the **Browser Storage Provider** gives us the freedom to create, save, and delete boards as we see fit. In other cases, such as Board Servers, it may be possible only to perform _some_ of those actions, depending on our permissions.

If the current Provider allows it, we can save a board using the **Save** button in the top navigation.

![The Save button in the top navigation](/breadboard/static/images/using-the-visual-editor/save-button.png)

This will save the board contents to the Provider.

If the board is read-only for any reason, we will instead see the **Save As** button in the top navigation.

![The Save button in the top navigation](/breadboard/static/images/using-the-visual-editor/save-as-button.png)

This will show us the **Save As... dialog** where we can choose a Provider that allows us to write boards.

![The Save As... dialog](/breadboard/static/images/using-the-visual-editor/save-as-dialog.png)

> [!TIP]
> We can also use `Cmd`/`Ctrl` + `S` to Save, or `Cmd`/`Ctrl` + `Shift` + `S` to Save As... at any point. If the board we are working with is read only, the the Save keyboard shortcut will show the Save As dialog instead.

### Deleting Boards

To delete a board we find it in the Provider list and we click the trash can icon next to its name.

![The board delete button](/breadboard/static/images/using-the-visual-editor/delete-button.png)

> [!NOTE]
> Deleting a board is irreversible, so be mindful of doing so if a board is public on a Board Server where others may be relying on it.

### Managing Providers

In the side navigation there is the option to manage Providers. This can be accessed by clicking on the icon next to the Provider list.

![The button to choose to manage Providers](/breadboard/static/images/using-the-visual-editor/manage-providers.png)

This will show an overflow menu where we can choose to **add a new Provider**.

![The new Provider dialog](/breadboard/static/images/using-the-visual-editor/new-provider-dialog.png)

This new Provider can be one of two types:

1. **A Board Server**. A Board Server is a remote store of boards, which can be used in a similar way to the local board store, but which allows us to share our boards with others. The reference implementation for the Board Server can be found in the [Breadboard GitHub repo](https://github.com/breadboard-ai/breadboard/tree/main/packages/board-server).
2. **A File System Directory**. It is possible to mount a directory from your device, and to use that as a board Provider. Please note, though, that currently the File System API is **only available in Chrome**, and that it shows only files ending in `.json` within the selected directory.

Any Provider that we have added can also be removed by clicking on the icon next to the Provider list, and by choosing **Remove provider**.

![The Provider actions](/breadboard/static/images/using-the-visual-editor/provider-menu.png)

> [!NOTE]
> If we use a File System Provider and change the directory's contents outside of Breadboard we won't automatically see it reflected in the Visual Editor. We can use the **Refresh provider** option in the overflow menu to update the board listing at any time.

### Creating New Boards

We can create a new board by clicking on the **New board** button either in the side menu or the [Welcome Pane](#the-welcome-pane).

![The side menu in the Visual Editor](/breadboard/static/images/using-the-visual-editor/side-menu.png)

This will launch the **Create new board** dialog, where we can choose which Provider should store the board, what title we would like to give it, and what file name we want to use.

![The Create new board dialog](/breadboard/static/images/using-the-visual-editor/create-board-dialog.png)

> [!NOTE]
> File names must be unique within a given Provider. The Visual Editor will therefore try to prevent you from creating a board if the file name matches one that already exists.

### Closing a Board

When we are done with a board we can close it by clicking on the cross icon next to its title in the top navigation.

![The Close board button](/breadboard/static/images/using-the-visual-editor/close-board.png)

Closing a board takes us back to the [Welcome Pane](#the-welcome-pane).

### Updating Board Information

Sometimes we want to change the title, version, and description of the board we are working with. We can do this in the right hand pane, by expanding the **Board details** section and changing the contents.

![The Board details section in the right hand pane](/breadboard/static/images/using-the-visual-editor/board-details.png)

> [!NOTE]
> We generally discourage the changing of file names, especially in the case of Board Servers, as people may come to rely on a given board and changing a shared board location may break things for others. [Cool URIs don't change](https://www.w3.org/Provider/Style/URI).

As well as changing the title, version, and description for a board we can also change its visibility, and mark the board as a Tool.

Visibility settings are specific to a Provider, and in the case of a Board Server particularly setting a board's visibility to **Draft** (the default) means that it will only show up for you, and not for other users of the Board Server.

Marking the board as a **Tool** indicates to the Visual Editor that we expect this board to be used by other components, such as the [Agent Kit's Specialist](../../kits/agents/#specialist).

> [!TIP]
> If you are new to Tools in Breadboard, why not check out [our guide on creating one](./first-tool/)?

When we look in the Provider list we can identify public boards by the earth icon next to them, and tools by the hammer and wrench icon instead of the general board icon.

![A public Tool board with icons denoting its status](/breadboard/static/images/using-the-visual-editor/public-tool.png)

[Next: Components](../components/)
