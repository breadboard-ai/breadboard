#!/usr/bin/env bash

set -e
# -e: Exit immediately if a command exits with a non-zero status.
set -u
# -u: Treat unset variables as an error when substituting.
set -o pipefail
# -o pipefail: The return value of a pipeline is the status of the last command to exit with a non-zero status, or zero if no command exited with a non-zero status.

# CD to script directory
cd "$(dirname "$0")"

# Ascend until package.json is found (project root)
while [ ! -f package.json ]; do
	cd ..
done

project="$(gcloud config get project)"
location="$(gcloud config get artifacts/location)"

# If the project is in a organization, the full project name will be
# "org:project". The org and project need to be separate path elements in the
# repo URL. Replace the colon with a slash.
project="${project/:/\/}"

domain="${location}-docker.pkg.dev"
image_url="${domain}/${project}/breadboard/unified-server"

gcloud auth configure-docker

docker build --build-context=breadboard=../.. --tag=unified-server .
docker tag unified-server ${image_url}
docker push ${image_url}

gcloud run deploy unified-server --image=${image_url}
