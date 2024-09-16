# Breadboard Board Server Reference Implementation

## Getting started

To run the board server locally with SQLite backend:
```
export GOOGLE_APPLICATION_CREDENTIALS=n/a
export STORAGE_BACKEND=sqlite
npm run migrate
npm run dev
```

## Running tests

To run the tests:

```
npm run test
npm run test:integration
```

## Choosing a storage backend

The board server can be run with different storage backends. The default is `firestore`, but you can also run it with `sqlite`.

To run locally with `sqlite`:

```
export GOOGLE_APPLICATION_CREDENTIALS=n/a
export STORAGE_BACKEND=sqlite
export SQLITE_DB_PATH=/path/to/board-server.db
```

## Initialize the database for local SQLite development

In `sqlite` mode, the board server uses Flyway for database migrations. To initialize the database using docker, run the following command:

```
npm run migrate
```

## Building with docker

The board server can be run as a self-contained docker image.

To build the container with the `sqlite` backend:

```
docker build --build-arg STORAGE_BACKEND=sqlite --build-context breadboard=../../ -t board-server:sqlite .
```

This container will use `sqlite` as a storage backend. It will keep its state in a file called `board-server.db` inside the working directory on the container.

To build the container with the `firestore` backend:

```
docker build --build-arg STORAGE_BACKEND=firestore --build-context breadboard=../../ -t board-server:firestore .
```

This container will use `firestore` backend and connect to Google Cloud Firestore database.

More than likely, in either case you will want to specify the `ALLOWED_ORIGINS` build argument:

```sh
docker build --build-arg ALLOWED_ORIGINS="list of visual editor urls" ...`
```

When building on Apple Silicon, use `platform` flag to specify the right platform:

```sh
docker build --platform linux/amd64 ...
```

To run the container:

```
docker run -d -p 3000:3000 --name board-server board-server
docker exec -it board-server /bin/bash
# npm run add <username> # add a user and copy your API key
```

## Deploying container on Cloud Run

[Create repository](https://cloud.google.com/artifact-registry/docs/repositories/create-repos#create-console)

Run credential helper:

```sh
 gcloud auth configure-docker us-central1-docker.pkg.dev
```

Get the full image name. See [Tagging the local image](https://cloud.google.com/artifact-registry/docs/docker/pushing-and-pulling#tag) for details.

Tag the local image with the repository name:

```sh
docker tag source-image image-name
```

Push image to repository

```sh
docker push image-name
```

Deploy to Cloud Run:

```sh
gcloud run deploy service-name --image image-name
```

## Firestore & App Engine deployment

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
