/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import process from "process";

import { makeCloudFunction } from "@google-labs/breadboard-server";

config();

export const board = makeCloudFunction(process.env.BOARD_URL);
