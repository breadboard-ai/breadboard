#!/bin/bash

gcloud functions deploy math \
--gen2 \
--runtime=nodejs20 \
--region=us-central1 \
--source=. \
--entry-point=math \
--trigger-http \
--allow-unauthenticated