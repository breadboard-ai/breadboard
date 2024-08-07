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

## Prerequisites

These instructions assume that the reader has a normal consumer (gmail.com)
Google account. They will detail how to set up a new Google Cloud project. If
you are using an existing Cloud project, or are a Workspace user, some of these
steps may be different or may not apply.

For Workspace users, some steps may require administrator privileges.

Required software:

- Git
- Node (v20.14.0 or higher)
- npm
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)

## System setup

Start by creating a local clone of the Breadboard Git repo.

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

## Part 1: Google Cloud setup

1. Navigate to https://console.cloud.google.com/ and accept the Cloud terms of
   service if you haven't already.
1. Click "Select a Project", and click "NEW PROJECT"
1. Give your project a name and complete the Cloud project setup

> [!NOTE]
> TODO: Set up AppEngine service account

## Deploying the Visual Editor

> [!NOTE]
> Coming soon

## Deploying the Connections Server

> [!NOTE]
> Coming soon

## Deploying the Board Server

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