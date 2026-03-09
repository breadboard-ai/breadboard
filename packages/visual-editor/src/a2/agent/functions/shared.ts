/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { tr } from "../../a2/utils.js";
import { type ArgsRawShape } from "../function-definition.js";

export {
  fileNameSchema,
  GENERATE_TEXT_FUNCTION,
  statusUpdateSchema,
  taskIdSchema,
};

/**
 * The canonical function name for the text generation tool.
 * Shared across system and generate function groups.
 */
const GENERATE_TEXT_FUNCTION = "generate_text";

const statusUpdateSchema = {
  status_update: z.string().describe(tr`
  A status update to show in the UI that provides more detail on the reason why this function was called.
  
  For example, "Creating random values", "Writing the memo", "Generating videos", "Making music", etc.`),
} satisfies ArgsRawShape;

const TASK_ID_PARAMETER = "task_id";

const taskIdSchema = {
  [TASK_ID_PARAMETER]: z
    .string(
      tr`If applicable, the "task_id" value of the relevant task in the task tree.`
    )
    .optional(),
} satisfies ArgsRawShape;

const fileNameSchema = {
  file_name: z
    .string()
    .describe(
      tr`Optional name for the generated file (without extension). Use snake_case for naming. The system will automatically add the appropriate extension based on the file type.`
    )
    .optional(),
} satisfies ArgsRawShape;
