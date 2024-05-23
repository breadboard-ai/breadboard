import { base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const fetchUrl = core.fetch({
  $id: "fetch",
  method: "GET",
  url: "https://date.nager.at/api/v3/NextPublicHolidaysWorldwide",
});

const output = base.output({
  $id: "output",
  dates: fetchUrl.response,
  schema: {
    type: "object",
    properties: {
      dates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: {
              type: "string",
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
              type: "number",
            },
            types: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: [
            "date",
            "localName",
            "name",
            "countryCode",
            "fixed",
            "global",
            "launchYear",
            "types",
          ],
        },
      },
    },
  },
});

export default await output.serialize({
  title: "Nager Date Next Public Holidays Worldwide API",
  description: "Get the next public holidays worldwide for the Nager Date API",
  version: "0.0.1",
});
