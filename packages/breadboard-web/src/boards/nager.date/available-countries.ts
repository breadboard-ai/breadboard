import { base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const fetchUrl = core.fetch({
  $id: "fetch",
  method: "GET",
  url: "https://date.nager.at/api/v3/AvailableCountries",
});

const output = base.output({
  $id: "output",
  dates: fetchUrl.response,
});

export default await output.serialize({
  title: "Nager Date Available Countries API",
  description: "Get the available countries for the Nager Date API",
  version: "0.0.1",
});
