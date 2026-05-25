export interface RunEntry {
  nodeId: string;
  nodeType: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  startTime: number;
  endTime?: number;
  nested?: RunLog;
}

export type RunLog = RunEntry[];

export function isIncludeNode(nodeType: string): boolean {
  return nodeType === "include";
}

export function isSlotNode(nodeType: string): boolean {
  return nodeType === "slot";
}

export interface MermaidOptions {
  direction?: "TB" | "TD" | "BT" | "RL" | "LR";
  nodeSpacing?: number;
  rankSpacing?: number;
  curveStyle?: "basis" | "linear" | "cardinal" | "step";
}
