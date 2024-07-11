# Breadboard Board Server Reference Implementation

Uses Firestore. Deploys to App Engine.

You will need to get ADC going to make Firestore work:

One-time setup:

- Login

```bash
gcloud auth login
```

```bash
gcloud auth application-default login
```

```bash
gcloud config set project <project name>
```

- Create App Engine App in Cloud Console

- [Enable Firestore API](https://console.cloud.google.com/marketplace/product/google/firestore.googleapis.com)

- [Create Firestore database](https://console.cloud.google.com/firestore/databases) named "board-server"

Then, to run locally, from the root of the repo:

```bash
npm run s
```

This will bring up the board server at `http://localhost:3000` and
a breadboard-web dev server at whatever port it launches (usually `http://localhost:5173/`).

To deploy:

```bash
npm run deploy
```

This will build the project and deploy it to App Engine.
