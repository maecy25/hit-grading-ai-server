# Production Deployment

GitHub Actions builds and pushes the server image to ECR on pushes to `master`, then deploys the immutable commit-SHA image through Dokploy using AWS Systems Manager.

## One-Time Setup

1. Create a Dokploy application with Docker source and container port `3001`.
2. Configure application environment in Dokploy:
   - `NODE_ENV=production`
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `DB_SSLMODE=require`
   - `DB_SSL_REJECT_UNAUTHORIZED=false`
   - `DB_SEARCH_PATH=public`
   - `LOCALHOST` set to frontend origin
   - `CHCK_API_KEY` and `CHCK_SECRET_KEY`
3. Configure Dokploy health checks for `GET /health` on port `3001`.
4. Generate Dokploy API key and store it as the SSM SecureString parameter:
   - `/hit-grading-ai/production/dokploy-api-key`
5. Set GitHub repository variables:
   - `EC2_INSTANCE_ID`: `i-0a942118705207e82`
   - `DOKPLOY_APPLICATION_ID`: Dokploy application ID

The EC2 role must have `ssm:GetParameter` access to the Dokploy API key parameter. Terraform grants this permission; apply infrastructure after adding the parameter path.

The workflow refreshes the ECR token on every deployment, so it does not store an expired 12-hour ECR password in Dokploy.

After Dokploy reports completion, the workflow also verifies that the target image is running as one Swarm replica and that the container's `/health` endpoint succeeds. A deployment that rolls back or starts without database connectivity fails the GitHub job.
