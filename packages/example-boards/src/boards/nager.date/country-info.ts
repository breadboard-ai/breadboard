import { base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { countryCodes } from "../../utils/countryCodes";

const input = base.input({
  $id: "query",
  schema: {
    type: "object",
    properties: {
      countryCode: {
        title: "countryCode",
        type: "string",
        description: "The data for countryCode",
        enum: countryCodes,
        default: "US",
      },
    },
    required: ["countryCode"],
  },
});

const urlTemplate = templates.urlTemplate({
  $id: "urlTemplate",
  template: "https://date.nager.at/api/v3/CountryInfo/{countryCode}",
  countryCode: input.countryCode,
});

const fetchUrl = core.fetch({
  $id: "fetch",
  method: "GET",
  url: urlTemplate.url,
});

const output = base.output({
  $id: "output",
  dates: fetchUrl.response,
});

export default await output.serialize({
  title: "Nager Date Country Info API",
  description: "Get the country info for the Nager Date API",
  version: "0.0.1",
});
