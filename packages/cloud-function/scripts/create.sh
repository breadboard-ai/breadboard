#!/bin/bash

# WIP to create the environment for deploying the functions.

# TODO: Enable all the right kind of APIs.

echo Enabling Firestore API

gcloud services enable firestore.googleapis.com

echo Creating Firestore database

gcloud firestore databases create \
  --location=us-west2 \
  --database=breadboard-state

gcloud firestore fields ttls update \
  expires --collection-group=states \
  --database=breadboard-state \
  --enable-ttl \
  --async