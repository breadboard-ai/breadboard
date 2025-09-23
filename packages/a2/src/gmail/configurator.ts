/**
 * @fileoverview Add a description for your module here.
 */

import { createConfigurator } from "../a2/connector-manager";

export { invoke as default, describe };

const { invoke, describe } = createConfigurator({
  title: "GMail",
  initialize: async () => {
    return { title: "GMail", configuration: {} };
  },
});
