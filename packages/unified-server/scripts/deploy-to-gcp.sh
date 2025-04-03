set -e
set -x

project="$(gcloud config get project)"
location="$(gcloud config get artifacts/location)"

# If the project is in a organization, the full project name will be
# "org:project". The org and project need to be separate path elements in the
# repo URL. Replace the colon with a slash.
project="${project/:/\/}"

domain="${location}-docker.pkg.dev"
image_url="${domain}/${project}/breadboard/unified-server"

docker build --build-context=breadboard=../.. --tag=unified-server .
docker tag unified-server ${image_url}
docker push ${image_url}

gcloud run deploy unified-server --image=${image_url}

