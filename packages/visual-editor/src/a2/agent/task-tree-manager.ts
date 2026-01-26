/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentFileSystem } from "./file-system.js";

export { TaskTreeManager };

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
    return this.fileSystem.write(
      "task_tree",
      JSON.stringify(this.tree),
      "application/json"
    );
  }

  set(tree: TaskTree) {
    console.log("WHAT IS THIS", tree);
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
