/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input, output } from "@breadboard-ai/build";
import { fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";

const countryCode = input({
  title: "Country Code",
  description: "Two-letter country code",
});

const url = urlTemplate({
  $metadata: {
    title: "URL Template",
    description: "Creating the API URL",
  },
  template: "https://date.nager.at/api/v3/NextPublicHolidays/{countryCode}",
  countryCode: countryCode,
});

const callAPI = fetch({
  $metadata: {
    title: "Call API",
    description:
      "Calling the Nager Date API to get the next public holiday for the given country",
  },
  url: url.outputs.url,
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
});

const holidays = output(callAPI.outputs.response, {
  title: "Holidays",
  description: "A list of public holidays for the given country",
});

export default board({
  title: "Nager Date Next Public Holiday",
  description: "Get the next public holiday for a given country",
  version: "0.0.1",
  inputs: { countryCode },
  outputs: { holidays },
});
