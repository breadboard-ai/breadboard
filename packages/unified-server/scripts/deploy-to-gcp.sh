set -e
set -x

project="$(gcloud config get project)"
location="$(gcloud config get artifacts/location)"

domain="${location}-docker.pkg.dev"
image_url="${domain}/${project}/breadboard/unified-server"

docker build --build-context=breadboard=../.. --tag=unified-server .
docker tag unified-server ${image_url}
docker push ${image_url}

gcloud run deploy unified-server --image=${image_url}

