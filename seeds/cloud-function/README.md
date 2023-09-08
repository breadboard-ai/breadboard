# Experimenting with Cloud Functions and Breadboard

This is likely to change dramatically, but we have to start somewhere.

## Setup

Install gcloud CLI: https://cloud.google.com/sdk/docs/install

Login with Application-default credentials (ADC):

```bash
gcloud auth application-default login
```

Select the project you want to use:

```bash
gcloud config set project ${PROJECT_ID}
```

This project is currently in Javascript, not Typescript, so it does not need to be built.

```bash

npm run deploy ${graph}

```

For now, `${graph}` value is limited to one of the filenames in the `graphs` directory of the `seeds/graph-playground` package.

For example, running:

```bash

npm run deploy accumulating-context.json

```

Will deploy a new version of a cloud function named `accumulating-context` in the current GCP project.
