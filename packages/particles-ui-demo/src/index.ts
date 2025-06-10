/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TodoListView } from "./ui/todo-list.js";
import { List } from "./state/list.js";

const todoList = new TodoListView();
todoList.items = new List().items;

document.body.appendChild(todoList);
