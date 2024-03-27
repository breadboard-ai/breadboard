import { base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { countryCodes } from "../../utils/countryCodes";

const getCurrentYear = code((): { year: number } => {
  return {
    year: new Date().getFullYear(),
  };
});

const input = base.input({
  $id: "query",
  year: getCurrentYear({ $id: "getCurrentYear" }).year,
  schema: {
    type: "object",
    properties: {
      year: {
        title: "year",
        type: "number",
        description: "The data for year",
        default: new Date().getFullYear().toString(),
      },
      countryCode: {
        title: "countryCode",
        type: "string",
        description: "The data for countryCode",
        enum: countryCodes,
        default: "US",
      },
    },
    required: ["year", "countryCode"],
  },
});

const urlTemplate = templates.urlTemplate({
  $id: "urlTemplate",
  template: "https://date.nager.at/api/v3/LongWeekend/{year}/{countryCode}",
  year: input.year,
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
  title: "Nager Date Long Weekend API",
  description: "API for long weekends",
  version: "0.0.1",
});
