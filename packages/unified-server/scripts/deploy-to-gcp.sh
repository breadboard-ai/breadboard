set -e
set -x

project="$(gcloud config get project)"
location="$(gcloud config get artifacts/location)"
service_name="${1:-unified-server}"

# If the project is in a organization, the full project name will be
# "org:project". The org and project need to be separate path elements in the
# repo URL. Replace the colon with a slash.
project="${project/:/\/}"

domain="${location}-docker.pkg.dev"
image_url="${domain}/${project}/breadboard/${service_name}"

docker build --build-context=breadboard=../.. --tag=${service_name} .
docker tag ${service_name} ${image_url}
docker push ${image_url}

gcloud run deploy ${service_name} --image=${image_url}

