/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tr } from "../a2/utils.js";
import { AgentFileSystem } from "./file-system.js";

export { TASK_TREE_SCHEMA, TaskTreeManager };

const TASK_TREE_SCHEMA = {
  type: "object",
  definitions: {
    TaskNode: {
      type: "object",
      required: ["task_id", "description", "execution_mode", "status"],
      properties: {
        task_id: {
          type: "string",
          description: tr`
The unique id of the task, must be in the format of "task_NNN" where NNN is the number`,
        },
        description: {
          type: "string",
          description:
            "Detailed explanation of what fulfilling this objective entails.",
        },
        execution_mode: {
          type: "string",
          description:
            "Defines how immediate subtasks should be executed. 'serial' means one by one in order; 'concurrent' means all at the same time.",
          enum: ["serial", "concurrent"],
        },
        status: {
          type: "string",
          description: "The current status of a task",
          enum: ["not_started", "in_progress", "complete"],
        },
        subtasks: {
          type: "array",
          description:
            "Ordered list of child tasks. If execution_mode is serial, the order matters.",
          items: {
            $ref: "#/definitions/TaskNode",
          },
        },
      },
    },
  },
  properties: {
    task_tree: {
      type: "object",
      $ref: "#/definitions/TaskNode",
    },
  },
};

export type TaskTreeNode = {
  task_id: string;
  description: string;
  execution_mode: "serial" | "concurrent";
  status: "not_started" | "in_progress" | "complete";
  subtasks?: TaskTreeNode[];
};

export type TaskTree = TaskTreeNode;

class TaskTreeManager {
  private tree: TaskTree | null = null;
  private taskMap = new Map<string, TaskTreeNode>();
  private messageMap = new Map<string, string>();

  constructor(private readonly fileSystem: AgentFileSystem) {}

  private save() {
    return this.fileSystem.overwrite(
      "task_tree.json",
      JSON.stringify(this.tree)
    );
  }

  set(tree: TaskTree) {
    this.tree = tree;
    this.taskMap.clear();
    this.messageMap.clear();
    const updateTaskMap = (tasks: TaskTreeNode[]) => {
      for (const task of tasks) {
        this.taskMap.set(task.task_id, task);
        if (task.subtasks) {
          updateTaskMap(task.subtasks);
        }
      }
    };
    updateTaskMap([this.tree]);
    return this.save();
  }

  get(): string {
    return JSON.stringify(this.tree) || "";
  }

  private trimTaskId(taskId: string) {
    return taskId.split("_").slice(0, 2).join("_");
  }

  setInProgress(taskId: string | undefined, progressMessage: string) {
    if (!taskId) return;

    const trimmedTaskId = this.trimTaskId(taskId);
    const task = this.taskMap.get(trimmedTaskId);
    if (!task) return;

    task.status = "in_progress";
    this.messageMap.set(trimmedTaskId, progressMessage);
    this.save();
  }

  setComplete(taskIds: string[]) {
    for (const taskId of taskIds) {
      const task = this.taskMap.get(this.trimTaskId(taskId));
      if (!task) continue;
      task.status = "complete";
    }
    return this.save();
  }
}
