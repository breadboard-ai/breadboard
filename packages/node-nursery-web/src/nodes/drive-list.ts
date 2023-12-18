/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeHandler,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";
import { GoogleClient, loadAPIs, loadClient, loadGapi } from "../gapi.js";

const DRIVE_DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

interface DriveInterface {
  drive?: {
    files: {
      list: (params: { q?: string }) => Promise<unknown>;
    };
  };
}

export type DriveListInputs = InputValues & {
  accessToken: string;
  q?: string;
};

export type DriveListOutputs = OutputValues & {
  list: string[];
};

export default {
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { accessToken, q } = inputs as DriveListInputs;
    const gapi = await loadGapi();
    const client = (await loadAPIs(await loadClient(gapi), {
      [DRIVE_DISCOVERY_DOC]: "drive",
    })) as GoogleClient & DriveInterface;
    if (!gapi.auth.getToken()) {
      gapi.auth.setToken({
        access_token: accessToken,
      } as GoogleApiOAuth2TokenObject);
    }
    const list = (await client.drive?.files.list({
      q,
    })) as NodeValue[];
    return { list };
  },
} satisfies NodeHandler;
