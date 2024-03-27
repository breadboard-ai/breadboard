import { base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { countryCodes } from "../../utils/countryCodes";

const inputs = base.input({
  $id: "query",
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
  template: "https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}",
  year: inputs.year,
  countryCode: inputs.countryCode,
});

const fetchUrl = core.fetch({
  $id: "fetch",
  method: "GET",
  url: urlTemplate.url,
});

const output = base.output({
  $id: "output",
  dates: fetchUrl.response,
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        date: {
          type: "string",
          format: "date",
        },
        localName: {
          type: "string",
        },
        name: {
          type: "string",
        },
        countryCode: {
          type: "string",
        },
        fixed: {
          type: "boolean",
        },
        global: {
          type: "boolean",
        },
        counties: {
          type: "array",
          items: {
            type: "string",
          },
        },
        launchYear: {
          type: "integer",
        },
        type: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
    },
  },
});

export default await output.serialize({
  title: "Nager Date Public Holidays API",
  description: "Get the public holidays for the Nager Date API",
  version: "0.0.1",
});
