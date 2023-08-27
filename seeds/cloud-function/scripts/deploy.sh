#!/bin/bash

gcloud functions deploy first-ever-function \
--gen2 \
--runtime=nodejs20 \
--region=us-central1 \
--source=. \
--entry-point=hello \
--trigger-http \
--allow-unauthenticated