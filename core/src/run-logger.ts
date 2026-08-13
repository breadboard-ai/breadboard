export interface RunEntry {
  id: string;
  type: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startTime: number;
  endTime?: number;
  parent?: string;
}

export interface RunLog {
  entries: RunEntry[];
  duration: number;
}

export class RunLogger {
  private entries: RunEntry[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private stack: RunEntry[] = [];

  start(): void {
    this.startTime = Date.now();
  }

  stop(): void {
    this.endTime = Date.now();
  }

  nodeEntry(id: string, type: string, inputs: Record<string, unknown>): void {
    const entry: RunEntry = {
      id,
      type,
      inputs: { ...inputs },
      startTime: Date.now(),
      parent: this.stack.length > 0 ? this.stack[this.stack.length - 1].id : undefined,
    };
    this.entries.push(entry);
    this.stack.push(entry);
  }

  nodeExit(id: string, outputs: Record<string, unknown>): void {
    const entry = this.stack.pop();
    if (entry && entry.id === id) {
      entry.outputs = { ...outputs };
      entry.endTime = Date.now();
    }
  }

  nodeError(id: string, error: Error | string): void {
    const entry = this.stack.pop();
    if (entry && entry.id === id) {
      entry.error = typeof error === "string" ? error : error.message;
      entry.endTime = Date.now();
    }
  }

  nestedGraphEntry(id: string, type: string, inputs: Record<string, unknown>): void {
    this.nodeEntry(id, type, inputs);
  }

  nestedGraphExit(id: string, outputs: Record<string, unknown>): void {
    this.nodeExit(id, outputs);
  }

  toJSON(): RunLog {
    return {
      entries: [...this.entries],
      duration: this.endTime - this.startTime,
    };
  }

  toMermaid(): string {
    const lines: string[] = ["flowchart TD"];
    const nodeIds = new Set<string>();
    
    for (const entry of this.entries) {
      const safeId = entry.id.replace(/[^a-zA-Z0-9_]/g, "_");
      if (!nodeIds.has(safeId)) {
        nodeIds.add(safeId);
        lines.push(`  ${safeId}["${entry.type}"]`);
      }
      if (entry.parent) {
        const safeParent = entry.parent.replace(/[^a-zA-Z0-9_]/g, "_");
        lines.push(`  ${safeParent} --> ${safeId}`);
      }
    }
    
    return lines.join("\n");
  }
}