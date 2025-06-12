/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";
import { UiReceiver } from "./ui/ui-receiver.js";
import { Generator } from "./generator.js";
import { List } from "./ui/elements/list.js";
import { theme } from "./ui/styles/default.js";

const generator = new Generator();
const receiver = new Receiver(generator);
generator.connect(receiver);

const uiReceiver = new UiReceiver();
uiReceiver.receiver = receiver;

document.body.appendChild(uiReceiver);

const params = new URLSearchParams(window.location.search);

if (params.get("cards")) {
  const styles = theme;
  const cards = new List();
  cards.theme = styles;
  document.body.appendChild(cards);
}
