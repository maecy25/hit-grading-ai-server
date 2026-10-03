#!/usr/bin/env bash
set -Eeuo pipefail

: "${IMAGE:?IMAGE is required}"
: "${APPLICATION_ID:?APPLICATION_ID is required}"
: "${DOKPLOY_API_PARAMETER_NAME:?DOKPLOY_API_PARAMETER_NAME is required}"
: "${AWS_REGION:?AWS_REGION is required}"

DOKPLOY_URL="${DOKPLOY_URL:-http://127.0.0.1:3000}"
REGISTRY="${IMAGE%%/*}"

api_key=$(aws ssm get-parameter \
  --name "$DOKPLOY_API_PARAMETER_NAME" \
  --with-decryption \
  --region "$AWS_REGION" \
  --query 'Parameter.Value' \
  --output text)

ecr_password=$(aws ecr get-login-password --region "$AWS_REGION")

curl --fail-with-body --silent --show-error \
  --retry 3 \
  --retry-connrefused \
  -X POST "$DOKPLOY_URL/api/application.saveDockerProvider" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $api_key" \
  --data "$(jq -cn \
    --arg application_id "$APPLICATION_ID" \
    --arg image "$IMAGE" \
    --arg password "$ecr_password" \
    --arg registry "$REGISTRY" \
    '{applicationId: $application_id, dockerImage: $image, username: "AWS", password: $password, registryUrl: $registry}')"

deployment_title="Deploy $IMAGE $(date -u +%Y%m%d%H%M%S)"
deployment_response=$(curl --fail-with-body --silent --show-error \
  --retry 3 \
  --retry-connrefused \
  -X POST "$DOKPLOY_URL/api/application.deploy" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $api_key" \
  --data "$(jq -cn \
    --arg application_id "$APPLICATION_ID" \
     --arg title "$deployment_title" \
     --arg description "GitHub Actions deployment" \
     '{applicationId: $application_id, title: $title, description: $description}')")
deployment_id=$(jq -r '.deploymentId // .id // empty' <<<"$deployment_response")

deployment_status=''

for attempt in {1..120}; do
  deployments=$(curl --fail-with-body --silent --show-error \
    --retry 3 \
    --retry-connrefused \
    -G "$DOKPLOY_URL/api/deployment.all" \
    -H "x-api-key: $api_key" \
    --data-urlencode "applicationId=$APPLICATION_ID")

  status=$(jq -r --arg deployment_id "$deployment_id" --arg deployment_title "$deployment_title" '
    if type == "array" then
      if $deployment_id != "" then
        first(.[] | select(.deploymentId == $deployment_id) | .status) // empty
      else
        first(.[] | select(.title == $deployment_title) | .status) // empty
      end
    elif type == "object" and $deployment_id != "" and .deploymentId == $deployment_id then
      .status // .applicationStatus // empty
    elif type == "object" and .title == $deployment_title then
      .status // .applicationStatus // empty
    else empty
    end' <<<"$deployments")

  case "$status" in
    done)
      echo "Dokploy deployment completed"
      deployment_status=done
      break
      ;;
    error|failed|cancelled)
      echo "Dokploy deployment failed with status: $status" >&2
      exit 1
      ;;
  esac

  sleep 5
done

if [[ "$deployment_status" != done ]]; then
  echo "Timed out waiting for Dokploy deployment" >&2
  exit 1
fi

# Dokploy can report done after creating a Swarm update that later rolls back.
# Verify target image, replica convergence, and the container health endpoint.
for attempt in {1..60}; do
  service_name=''
  service_replicas=''
  service_image=''

  while read -r candidate_name candidate_replicas candidate_image; do
    if [[ "$candidate_image" == "$IMAGE" || "$candidate_image" == "$IMAGE@"* ]]; then
      service_name="$candidate_name"
      service_replicas="$candidate_replicas"
      service_image="$candidate_image"
      break
    fi
  done < <(docker service ls --format '{{.Name}} {{.Replicas}} {{.Image}}')

  if [[ "$service_replicas" == '1/1' ]]; then
    running_containers=$(docker ps \
      --filter "label=com.docker.swarm.service.name=$service_name" \
      --filter status=running \
      --format '{{.ID}}')
    container_id="${running_containers%%$'\n'*}"

    if [[ -n "$container_id" ]] && docker exec "$container_id" node -e \
      "fetch('http://127.0.0.1:3001/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"; then
      echo "Swarm deployment healthy: $service_name $service_replicas $service_image"
      exit 0
    fi
  fi

  sleep 5
done

echo "Swarm deployment did not become healthy" >&2
docker service ls >&2
exit 1
