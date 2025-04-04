/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";

export { invoke as default, describe };

const CONNECTOR_TITLE = "Google Drive";

const { invoke, describe } = createConfigurator({
  title: CONNECTOR_TITLE,
  initialize: async () => {
    return { title: "Untitled Drive File", configuration: {} };
  },
});
