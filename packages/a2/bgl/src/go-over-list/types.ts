/**
 * @fileoverview Common types.
 */

export type Task = {
  label: string;
  task: string;
};

export type Plan = {
  thinking?: string;
  todo: Task[];
  summarizeResults: boolean;
};

export type Strategy = "Parallel" | "Sequence";

export type ExecuteStepFunction = (
  item: Task
) => Promise<LLMContent | undefined>;

export type Strategist = {
  name: string;
  execute(
    singleStepExecutor: ExecuteStepFunction,
    mutableContext: LLMContent[],
    objective: LLMContent,
    makeList?: boolean
  ): Promise<Outcome<LLMContent[]>>;
};

export type Invokable<T> = {
  invoke(): T;
};
