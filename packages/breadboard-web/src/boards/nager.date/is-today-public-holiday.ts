import { base, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { countryCodes } from "../../utils/countryCodes";

const inputs = base.input({
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
      offset: {
        title: "offset",
        type: "number",
        description: "utc timezone offset",
        maximum: 12,
        minimum: -12,
        default: "0",
      },
    },
    required: ["year", "countryCode"],
  },
});

const urlTemplate = templates.urlTemplate({
  $id: "urlTemplate",
  template:
    "https://date.nager.at/Api/v3/IsTodayPublicHoliday/{countryCode}?{&offset}",
  countryCode: inputs.countryCode,
  offset: inputs.offset,
});

const fetchUrl = core.fetch({
  $id: "fetch",
  raw: true,
  method: "GET",
  url: urlTemplate.url,
});

const statusCodeToResult = code(
  ({
    status,
  }: {
    status: number;
  }): {
    isPublicHoliday: boolean;
  } => {
    if (status === 200) {
      return {
        isPublicHoliday: true,
      };
    } else if (status === 204) {
      return {
        isPublicHoliday: false,
      };
    }
    throw new Error(`Unexpected status code: ${status}`);
  }
);
const result = statusCodeToResult({
  $id: "statusCodeToResult",
  status: fetchUrl.status,
});
const output = base.output({
  $id: "output",
  isPublicHoliday: result.isPublicHoliday,
  schema: {
    type: "object",
    properties: {
      isPublicHoliday: {
        type: "boolean",
      },
    },
    required: ["isPublicHoliday"],
  },
});

export default await output.serialize({
  title: "Is Today a Public Holiday",
  description: "Get the public holidays for today for the Nager Date API",
  version: "0.0.1",
});
