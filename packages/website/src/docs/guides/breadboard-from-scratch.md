---
layout: docs.liquid
title: Breadboard from scratch
tags:
  - wip
---

_Work in progress. See <https://github.com/breadboard-ai/breadboard/issues/2675>_

This guide is targeted at a developer who wants to deploy their own Breadboard
instance with no previous setup or configuration. It will cover all components
and all current features.

> [!NOTE]
> Writing this document is part of an effort to document and improve this
> workflow. Expect this process to change over time.

## Prerequisites: Required software

This guide assumes that the reader has the following software installed in their
local environment.

- Git
- Node (v20.14.0 or higher)
- npm
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)

---

## Part 1: Google Cloud setup

This guide will show you how to deploy Breadboard using Google Cloud. All three
servers will be deployed using [App Engine](https://cloud.google.com/appengine).

### Create a new Google Cloud project

> [!NOTE]
> These instructions assume that the reader has a normal consumer (gmail.com)
> Google account. They will detail how to set up a new Google Cloud project. If
> you are using an existing Cloud project, or are a Workspace user, some of these
> steps may be different or may not apply.

> [!NOTE]
> For Workspace users, some steps may require administrator privileges.

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/) and
   accept the Cloud terms of service if you haven't already.
2. Click **Select a Project**, and click **NEW PROJECT**
3. Give your project a name and complete the Cloud project setup

### Configure the `gcloud` CLI

Authenticate with the `gcloud` CLI.

```sh
gcloud auth login
```

```sh
gcloud auth application-default login
```

This will open a browser on your local machine to complete the authentication flow.

Set your project as the current project.

```sh
gcloud config set project your-project-id
```

All future commands will now reference this project by default.

### Enable App Engine and Cloud Billing

App Engine requires a billing account. This section will walk you through the
steps, assuming that no previous setup has been performed. See [this help center
article](https://cloud.google.com/appengine/docs/standard/managing-projects-apps-billing)
for more information.

In the [Google Cloud Console](https://console.cloud.google.com), go to [App
Engine](https://console.cloud.google.com/appengine). If no billing account
exists, you will be prompted to set up billing for your Cloud project.

### Configure the App Engine service account

App Engine requires the default service account to possess both the **Editor**
and **Storage Admin** roles to successfully deploy applications. As of May 2024,
it is no longer possible for App Engine to make this change automatically. It
will need to be done manually.

> [!NOTE]
> If you are using an established project, or have already configured a service
> account, this step may not be necessary. See [the troubleshooting
> guide](https://cloud.google.com/appengine/docs/standard/troubleshooting#default-sa-permissions)
> for more information.

1. Go to [Identity & Access Management](https://pantheon.corp.google.com/iam-admin/iam) in Google Cloud console.
1. Locate the default App Engine service account: **`${PROJECT_ID}@appspot.gserviceaccount.com`**
1. Click **Edit Principal** (the pencil icon)
1. Ensure that the service account has both the **Editor** and **Storage Admin** roles.

### Create the App Engine application

Run the following command to create an App Engine application.

```sh
gcloud app create
```

This will interactively walk through the process of selecting a region to which to
deploy your application, plus other setup options. For more information and
additional options, see the [SDK
documentation](https://cloud.google.com/sdk/gcloud/reference/app/create).

---

## Part 2: Deploying the servers

Breadboard is composed of three separate servers: the Visual Editor, the
Connection Server, and the Board Server.

### Create a local copy of the repo

You will need a local clone of the Breadboard Git repo.

```sh
git clone https://github.com/breadboard-ai/breadboard
```

```sh
cd breadboard
```

Install dependencies and build.

```sh
npm i
```

```sh
npm run build
```

These steps should complete without error. If you encounter any issues, please
feel free to get in touch with the team on Discord.

### Deploy the Visual Editor

From the root of the repository.

```sh
cd packages/visual-editor
```

```sh
gcloud app deploy
```

This will deploy the Visual Editor as the default App Engine application. You
should now be able to access and use the Visual Editor at the URL given in the
console output. You can also see the deployed service on the [App Engine
dashboard](https://console.cloud.google.com/appengine/services).

### Deploy the Connection Server

The Connection Server is responsible for hosting client secrets and creating
access tokens for boards running in the Visual Editor. See the
[README](https://github.com/breadboard-ai/breadboard/blob/main/packages/connection-server/README.md)
for more information.

#### Create a secrets file

Create a new JSON file called `packages/connection-server/secrets/secrets.json`:

```json
{
  "connections": []
}
```

By default, our server will host no secrets. We will come back and add secrets in **Part 2**.

#### Create an `app.yaml` file

Create a new YAML file at `packages/connection-server/app.yaml`:

```yaml
service: connections

runtime: nodejs22

instance_class: F1

handlers:
  - url: /.*
    secure: always
    redirect_http_response_code: 301
    script: auto

env_variables:
  CONNECTIONS_FILE: "secrets/secrets.json"
  ALLOWED_ORIGINS: "{YOUR_VISUAL_EDITOR_ORIGIN}"
```

Be sure to provide the
[origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin) of
your Visual Editor as the value of the `ALLOWED_ORIGINS` variable. Multiple
origins can be separated by spaces. Requests from origins not in this list will
be rejected.

#### Deploy the server

From the repository root:

```sh
cd packages/connection-server
```

```sh
gcloud app deploy
```

Your Connection Server is now deployed to an App Engine service called `connections`.

However, it does not have any connections configuered, and your Visual Editor is
not yet configured to call it. We will set up this configuration in **Part 2**.

### Deploy the Board Server

#### Create a Firestore database

Board Server depends on Cloud Firestore for its storage backend.

You will need to select a location for your database. See the [help
center](https://cloud.google.com/firestore/docs/locations) for available
locations and for more information.

Choose an appropriate location:

```sh
LOCATION="your-selected-location"
```

Create a Firestore database called `board-server`:

```sh
gcloud firestore databases create --location=${LOCATION} --database=board-server
```

If you have not already enabled the Firestore API in your Cloud project, you
will be prompted to do so.

#### Configure CORS

CORS configuration for Board Server lives in Firestore. Configure the allowed
origins by adding the origin for your Visual Editor.

1. Open the [board-server](https://console.cloud.google.com/firestore/databases/board-server)
   database in Cloud Console.
2. Click **START COLLECTION**
3. Create a collection called **`configuration`** with a single document called
   **`board-server-cors`**
4. Add a single field called **`allow`** with a type of **`array`**
5. Add the origin of your Visual Editor instance to the array

#### Add user(s)

Each user who wishes to connect to a Board Server is identified by an API key.
These keys are created by an admin with write access to the `board-server` DB.

From the repository root:

```sh
cd packages/board-server
```

```sh
npm run add ${USERNAME}
```

This will run the user creation script and output the API key. The API key can
also be read from the Firestore database under `/users/{USERNAME}/apiKey`. The
API key will be used later when adding a provider in the Visual Editor.

#### Update `app.yaml`

By default, the Board Server is deployed as the default App Engine service.
Since we have deployed the Visual Editor as the default service, we want to
specify an explicit service name.

1. Open [`packages/board-server/app.yaml`](https://github.com/breadboard-ai/breadboard/blob/main/packages/board-server/app.yaml)
   in a text editor.
2. At the top of the file, add the following line:

```yaml
service: boards
# REST OF FILE REMAINS THE SAME
```

#### Deploy the server

From the repository root

```sh
cd packages/board-server
```

```sh
npm run deploy
```

This will deploy the service to App Engine. You can see details of the running
service in the [App Engine console](https://console.cloud.google.com/appengine/services)

---

## Part 3: Tying it all together

So far we have deployed each server as a separate, standalone entity. Further
configuration is required to enable the Visual Editor to make use of the
Connection and Board Servers.

### Add a Board Server provider

The Visual Editor can be configured to connect a number of different
**providers**. The default provider stores boards in local browser storage. You
can also add a Board Server as a provider. This allows sharing of boards between
users and devices.

In your Visual Editor:

1. Open the Breadboard menu by clicking on the three lines in the top-left
   corner
2. In the **Providers** menu, click **Add new provider**
3. Create a new **Board Server** provider by entering the URL of your board
   server, and your API key. (The API key can be found in the
   [users](https://console.cloud.google.com/firestore/databases/board-server/data/panel/users)
   collection in the Cloud Console.)

You can now create new boards on the board server, and access boards created by
yourself and other users.

### Add an API connection

> [!NOTE]
> Coming soon

---

## APPENDIX: Deploying the Visual Editor on Firebase hosting

> [!NOTE]
> This is an alternative option for deploying the Visual Editor. The Visual
> Editor is a simple static site, so it can be served from any service that
> supports serving static files. The process would be largely similar on any other
> static hosting service.

These instructions require the [Firebase CLI](https://firebase.google.com/docs/cli).

### Enable Firebase

1. Navigate to https://console.firebase.google.com/ and click "Create a project"
2. Complete the project creation flow, or click "Add Firebase to a Google Cloud
   project" to use an existing Cloud project.
3. Select the Google Cloud project that you would like to use

### Set up the Firebase CLI

Log in to Firebase on your local machine. This will open a browser window that
will take you through the authentication process.

```sh
firebase login
```

You should now be able to use the `firebase` command to access your Firebase
projects. You can test this by using the `projects:list` command.

```sh
firebase projects:list
✔ Preparing the list of your Firebase projects
┌──────────────────────┬──────────────────┬────────────────┬──────────────────────┐
│ Project Display Name │ Project ID       │ Project Number │ Resource Location ID │
├──────────────────────┼──────────────────┼────────────────┼──────────────────────┤
│ Your Project Name    │ your-project-id  │ 12345671234    │ [Not specified]      │
└──────────────────────┴──────────────────┴────────────────┴──────────────────────┘

1 project(s) total.
```

> [!NOTE]
> If you have recently created your Firebase project, there may be a small
> propagation delay before it appears in the `projects:list` result. You should
> make sure it does before continuing.

Set your project as the current project.

```sh
firebase use --add your-project-id
```

### Deploy to Firebase hosting

Now that the project is built and Firebase is configured, we can deploy the
static site.

```sh
cd packages/visual-editor
```

```sh
npm run deploy
```

That's it! By default, Firebase will deploy your site to a custom domain under
`web.app` and/or `firebaseapp.com`. You can see the exact URL in your
[console](https://console.firebase.google.com/). You should now be able to see
and use the Breadboard Visual Editor at this URL.
