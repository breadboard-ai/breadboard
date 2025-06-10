/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";
import { UiReceiver } from "./ui/ui-receiver.js";
import { Generator } from "./generator.js";

const generator = new Generator();
const receiver = new Receiver(generator);
generator.connect(receiver);

const uiReceiver = new UiReceiver();
uiReceiver.receiver = receiver;

document.body.appendChild(uiReceiver);
