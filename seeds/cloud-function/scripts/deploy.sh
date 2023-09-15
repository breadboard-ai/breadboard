#!/bin/bash

filename=$1

gcloud functions deploy ${filename%.*} \
--gen2 \
--runtime=nodejs20 \
--region=us-central1 \
--source=. \
--entry-point=board \
--trigger-http \
--allow-unauthenticated \
--set-secrets PALM_KEY=PALM_KEY:latest,GOOGLE_CSE_ID=GOOGLE_CSE_ID:latest \
--update-env-vars BOARD_URL=https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/${filename}