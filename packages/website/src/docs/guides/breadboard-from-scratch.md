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
1. Click **Select a Project**, and click **NEW PROJECT**
1. Give your project a name and complete the Cloud project setup

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
> If you are using an older project, or have already configured a service
> account, this step may not be necessary. See [the troubleshooting
> guide](https://cloud.google.com/appengine/docs/standard/troubleshooting#default-sa-permissions)
> for more information.

1. Go to [Identity & Access Management](https://pantheon.corp.google.com/iam-admin/iam) in Google Cloud console.
1. Locate the default App Engine service account: **`${PROJECT_ID}@appspot.gserviceaccount.com`**
1. Click **Edit Principal** (the pencil icon)
1. Ensure that the service account has both the **Editor** and **Storage Admin** roles.

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
> If you are using an older project, or have already configured a service
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

> [!NOTE]
> Coming soon

### Deploy the Board Server

> [!NOTE]
> Coming soon

## Part 2: Tying it all together

So far we have deployed each server as a separate, standalone entity. Further
configuration is required to enable the Visual Editor to make use of the
Connection and Board Servers.

> [!NOTE]
> Coming soon

## APPENDIX: Deploying the Visual Editor on Firebase hosting

> [!NOTE]
> This is an alternative option for deploying the Visual Editor. The Visual
> Editor is a simple static site, so it can be served from any service that
> supports serving static files. The process would be largely similar on any other
> static hosting service.

These instructions require the [Firebase CLI](https://firebase.google.com/docs/cli).

### Enable Firebase

1. Navigate to https://console.firebase.google.com/ and click "Create a project"
1. Complete the project creation flow, or click "Add Firebase to a Google Cloud
   project" to use an existing Cloud project.
1. Select the Google Cloud project that you would like to use

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
