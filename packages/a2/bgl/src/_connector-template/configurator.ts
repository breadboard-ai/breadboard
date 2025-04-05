/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";

import read from "@read";
import write from "@write";

export { invoke as default, describe };

const CONNECTOR_TITLE = "{{ title }}";

const { invoke, describe } = createConfigurator({
  title: CONNECTOR_TITLE,
  initialize: async () => {
    return { title: CONNECTOR_TITLE, configuration: {} };
  },
});
