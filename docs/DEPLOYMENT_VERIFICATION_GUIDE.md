# Deployment Verification Guide

This guide covers verifying the deployment of the Unifocus API and its infrastructure, including ALB health checks, endpoint verification, and CloudWatch log monitoring.

## Prerequisites for Deployment Verification

Before proceeding with workflow triggers and verification, ensure:

1. **Infrastructure is deployed** via Terraform

   ```bash
   # Check if Terraform state exists
   aws s3 ls s3://unifocus-terraform-state-dev/
   ```

2. **AWS Secrets are configured**:

   ```bash
   aws secretsmanager list-secrets --region us-east-1 | grep unifocus-dev
   ```

3. **GitHub repository secrets are configured**:
   - `AWS_ROLE_ARN`: The OIDC role for GitHub Actions
   - `ECR_REPOSITORY_NAME`: ECR repository name
   - `ECS_CLUSTER_NAME`: ECS cluster name
   - `ECS_SERVICE_NAME`: ECS service name
   - `ECS_TASK_FAMILY`: ECS task family name

## Phase 1: Pre-Deployment Checklist

### 1.1 Infrastructure Validation

```bash
# Check if ECS cluster exists
aws ecs list-clusters --region us-east-1

# Check if ECR repository exists
aws ecr describe-repositories --region us-east-1 | jq '.repositories[] | select(.repositoryName=="unifocus-api")'

# Check if RDS database exists
aws rds describe-db-instances --region us-east-1 | jq '.DBInstances[] | select(.DBInstanceIdentifier | contains("unifocus"))'

# Check ALB exists
aws elbv2 describe-load-balancers --region us-east-1 | jq '.LoadBalancers[] | select(.LoadBalancerName | contains("unifocus"))'
```

### 1.2 Secrets Manager Configuration

```bash
# List all secrets
aws secretsmanager list-secrets --region us-east-1 | jq '.SecretList[] | .Name'

# Retrieve database secret
aws secretsmanager get-secret-value --secret-id $(aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'db-credentials')].Name" --output text) --region us-east-1

# Retrieve Cognito secret
aws secretsmanager get-secret-value --secret-id $(aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'cognito')].Name" --output text) --region us-east-1
```

### 1.3 GitHub Repository Secrets

```bash
# Verify all required secrets are set (from local machine with gh CLI)
gh secret list --repo krisballew/Unifocus-Simple
```

## Phase 2: Trigger Deployment Workflow

### 2.1 Option A: Trigger via GitHub CLI

```bash
# Trigger the workflow
gh workflow run deploy-api-dev.yml \
  --repo krisballew/Unifocus-Simple \
  --ref main

# Watch the workflow
gh run list --repo krisballew/Unifocus-Simple --workflow deploy-api-dev.yml --limit 1
gh run watch <run-id> --repo krisballew/Unifocus-Simple
```

### 2.2 Option B: Trigger via GitHub Web UI

1. Go to: https://github.com/krisballew/Unifocus-Simple/actions
2. Select "Deploy API to Dev" workflow
3. Click "Run workflow"
4. Select "main" branch
5. Click "Run workflow"

### 2.3 Monitor Workflow Progress

```bash
# Get the latest run
LATEST_RUN=$(gh run list --repo krisballew/Unifocus-Simple --workflow deploy-api-dev.yml --limit 1 --json databaseId --query "[0].databaseId" --output raw)

# Watch in real-time
gh run watch $LATEST_RUN --repo krisballew/Unifocus-Simple

# View step logs
gh run view $LATEST_RUN --repo krisballew/Unifocus-Simple --log
```

**Expected Workflow Steps:**

1. Checkout code ✓
2. Configure AWS credentials (OIDC) ✓
3. Login to ECR ✓
4. Build Docker image ✓
5. Push image to ECR ✓
6. Download current task definition ✓
7. Update task definition with new image ✓
8. Deploy to ECS ✓
9. Wait for service stability ✓
10. Deployment summary ✓

## Phase 3: Post-Deployment Infrastructure Verification

### 3.1 Get ALB DNS Name

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[?contains(LoadBalancerName, `unifocus-dev-alb`)].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
```

### 3.2 Check ALB Target Group Health

```bash
# Get target group ARN
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
  --region us-east-1 \
  --query 'TargetGroups[?contains(TargetGroupName, `api`)].TargetGroupArn' \
  --output text)

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn "$TARGET_GROUP_ARN" \
  --region us-east-1 \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
  --output table

# Expected output:
# State: healthy (after health check passes)
# Reason: N/A (once registered and healthy)
```

**ALB Target States:**

- `initial`: Target is being registered
- `healthy`: Target passed health checks
- `unhealthy`: Target failed health checks
- `unused`: Target not registered
- `draining`: Target is deregistering
- `unavailable`: Target in maintenance

### 3.3 Check ECS Task Status

```bash
# Get cluster name
CLUSTER_NAME=$(aws ecs list-clusters \
  --region us-east-1 \
  --query 'clusterArns[?contains(@, `unifocus-dev`)]' \
  --output text | xargs basename)

# Get service name
SERVICE_NAME=$(aws ecs list-services \
  --cluster $CLUSTER_NAME \
  --region us-east-1 \
  --query 'serviceArns[?contains(@, `unifocus-dev-api-service`)]' \
  --output text | xargs basename)

# Get task details
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region us-east-1 \
  --query 'services[0].[serviceName,status,desiredCount,runningCount,deployments[0]]' \
  --output table

# Get running tasks
TASKS=$(aws ecs list-tasks \
  --cluster $CLUSTER_NAME \
  --service-name $SERVICE_NAME \
  --region us-east-1 \
  --query 'taskArns' \
  --output text)

# Get task details
aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASKS \
  --region us-east-1 \
  --query 'tasks[*].[taskArn,lastStatus,healthStatus,containers[0].lastStatus]' \
  --output table
```

**Expected Task Status Progression:**

1. `PROVISIONING` → `PENDING` → `ACTIVATING` → `RUNNING`
2. Health check: `HEALTHY`
3. Container status: `RUNNING`

### 3.4 Check CloudWatch Logs

```bash
# Get log group name
LOG_GROUP="/ecs/unifocus-dev-api"

# List recent log streams
aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --region us-east-1 \
  --max-items 5 \
  --query 'logStreams[*].[logStreamName,lastEventTimestamp]' \
  --output table

# Get latest logs (last 1000 lines, last 5 minutes)
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(($(date +%s) - 300))000 \
  --region us-east-1 \
  --query 'events[*].[message]' \
  --output text | head -50
```

## Phase 4: API Endpoint Verification

### 4.1 Health Endpoint

```bash
# Get ALB DNS (if not already set)
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[?contains(LoadBalancerName, `unifocus-dev-alb`)].DNSName' \
  --output text)

# Test health endpoint
curl -v "http://$ALB_DNS/health"

# Expected response (200 OK):
# {
#   "status": "ok",
#   "timestamp": "2026-02-03T20:15:30.123Z",
#   "uptime": 45.678
# }
```

### 4.2 Ready Endpoint

```bash
# Test ready endpoint
curl -v "http://$ALB_DNS/ready"

# Expected response (200 OK if database configured):
# {
#   "status": "ready",
#   "timestamp": "2026-02-03T20:15:30.123Z",
#   "checks": {
#     "database": "ok",
#     "redis": "error"  // OK - Redis is optional in dev
#   }
# }

# If database not accessible, expect 503 Service Unavailable:
# {
#   "status": "not_ready",
#   "timestamp": "2026-02-03T20:15:30.123Z",
#   "checks": {
#     "database": "error",
#     "redis": "error"
#   }
# }
```

### 4.3 ALB Response Headers

```bash
# Check for security headers
curl -v "http://$ALB_DNS/health" 2>&1 | grep -i "x-"

# Expected headers:
# x-correlation-id: <uuid>
# x-content-type-options: nosniff
# x-frame-options: DENY
# x-xss-protection: 1; mode=block
# strict-transport-security: max-age=31536000; includeSubDomains
```

## Phase 5: Troubleshooting Failed Deployments

### 5.1 Common Failure Scenarios

#### Scenario: Task fails to start (stuck in PROVISIONING)

**Symptoms:** Task stays in `PROVISIONING` or `PENDING` for > 2 minutes

**Diagnosis:**

```bash
# Check task logs for errors
aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASKS \
  --region us-east-1 \
  --query 'tasks[0].stoppedReason' \
  --output text

# Common reasons:
# - ECR image not found
# - Insufficient task memory
# - Security group misconfiguration
# - IAM role missing permissions
# - Invalid environment variables
```

**Fix:**

```bash
# Check ECR image exists
aws ecr describe-images \
  --repository-name unifocus-api \
  --region us-east-1

# Check task role permissions
aws iam get-role-policy \
  --role-name $(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASKS --region us-east-1 --query 'tasks[0].taskRoleArn' --output text | xargs basename) \
  --policy-name <policy-name>
```

#### Scenario: Health check fails (target unhealthy)

**Symptoms:** `/health` returns error or doesn't respond, target status: `unhealthy`

**Diagnosis:**

```bash
# Check application is running
aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASKS \
  --region us-east-1 \
  --query 'tasks[0].containers[0].[lastStatus,exitCode,reason]' \
  --output table

# Check logs for exceptions
aws logs filter-log-events \
  --log-group-name "/ecs/unifocus-dev-api" \
  --region us-east-1 \
  --filter-pattern "ERROR" \
  --query 'events[*].message' \
  --output text
```

**Fix:**

```bash
# Restart task
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region us-east-1

# Or stop and restart
aws ecs stop-task \
  --cluster $CLUSTER_NAME \
  --task $TASKS \
  --reason "Manual restart for troubleshooting" \
  --region us-east-1
```

#### Scenario: Database connection fails (ready returns 503)

**Symptoms:** `/ready` returns 503, logs show "Database connectivity check failed"

**Diagnosis:**

```bash
# Check database is accessible
aws rds describe-db-instances \
  --region us-east-1 \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `unifocus`)][DBInstanceIdentifier,DBInstanceStatus,AvailabilityZone]' \
  --output table

# Check security groups
aws ec2 describe-security-groups \
  --region us-east-1 \
  --query 'SecurityGroups[?contains(GroupName, `unifocus`) || contains(GroupDescription, `unifocus`)][GroupId,GroupName,IpPermissions[*]]' \
  --output table

# Check database secret
aws secretsmanager get-secret-value \
  --secret-id $(aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'db-credentials')].Name" --output text) \
  --region us-east-1 | jq '.SecretString | fromjson'
```

**Fix:**

```bash
# Update database secret with correct values
aws secretsmanager update-secret \
  --secret-id <secret-arn> \
  --secret-string '{"username":"...","password":"...","host":"...","port":5432,"dbname":"unifocus","engine":"postgres","dbConnectionString":"postgresql://..."}'

# Or re-run Terraform to recreate
terraform apply -target=module.secrets
```

#### Scenario: ECR image not found

**Symptoms:** "Image not found", task won't start

**Diagnosis:**

```bash
# List available images
aws ecr describe-images \
  --repository-name unifocus-api \
  --region us-east-1 \
  --query 'imageDetails[*].[imageTags,imageSize,imagePushedAt]' \
  --output table

# Check image URI in task definition
aws ecs describe-task-definition \
  --task-definition unifocus-dev-api \
  --region us-east-1 \
  --query 'taskDefinition.containerDefinitions[0].image' \
  --output text
```

**Fix:**

```bash
# Build and push image (from local machine)
cd services/api
docker build -t unifocus-api:latest .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag unifocus-api:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/unifocus-api:latest

# Then trigger deployment
gh workflow run deploy-api-dev.yml --repo krisballew/Unifocus-Simple
```

#### Scenario: Cognito environment variables not set

**Symptoms:** Authentication endpoints return errors, logs show missing Cognito config

**Diagnosis:**

```bash
# Check task environment
aws ecs describe-task-definition \
  --task-definition unifocus-dev-api \
  --region us-east-1 \
  --query 'taskDefinition.containerDefinitions[0].secrets' \
  --output table

# Check secrets exist
aws secretsmanager get-secret-value \
  --secret-id $(aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'cognito')].Name" --output text) \
  --region us-east-1 | jq '.SecretString | fromjson'
```

**Fix:**

```bash
# Update Cognito secret with actual values
aws secretsmanager update-secret \
  --secret-id <cognito-secret-arn> \
  --secret-string '{
    "userPoolId": "us-east-1_xxxxx",
    "clientId": "1a2b3c4d5e6f7g8h9i0j",
    "region": "us-east-1",
    "issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx",
    "jwtSecret": "your-jwt-secret"
  }'

# Force task update
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region us-east-1
```

### 5.2 Systematic Diagnostic Checklist

```bash
# Run this comprehensive diagnostic
echo "=== Infrastructure Status ==="
aws elbv2 describe-load-balancers --region us-east-1 | jq '.LoadBalancers[0].State.Code'
echo ""

echo "=== ECS Service Status ==="
CLUSTER=$(aws ecs list-clusters --region us-east-1 --query 'clusterArns[0]' --output text)
SERVICE=$(aws ecs list-services --cluster $CLUSTER --region us-east-1 --query 'serviceArns[0]' --output text)
aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region us-east-1 | jq '.services[0] | {serviceName, status, desiredCount, runningCount}'
echo ""

echo "=== Task Status ==="
TASKS=$(aws ecs list-tasks --cluster $CLUSTER --service-name $SERVICE --region us-east-1 --query 'taskArns[0]' --output text)
aws ecs describe-tasks --cluster $CLUSTER --tasks $TASKS --region us-east-1 | jq '.tasks[0] | {lastStatus, healthStatus, stoppedReason}'
echo ""

echo "=== Target Health ==="
TG=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --target-group-arn $TG --region us-east-1 | jq '.TargetHealthDescriptions[0] | {State: .TargetHealth.State, Reason: .TargetHealth.Reason}'
echo ""

echo "=== Recent Logs (last 50 lines) ==="
aws logs filter-log-events \
  --log-group-name "/ecs/unifocus-dev-api" \
  --start-time $(($(date +%s) - 600))000 \
  --region us-east-1 \
  --max-items 50 \
  --query 'events[*].message' \
  --output text
```

## Phase 6: Validation and Sign-Off

Once deployment is verified:

### 6.1 Run Full Verification Suite

```bash
# 1. Infrastructure up
curl -I http://$ALB_DNS/health

# 2. Health check responds
curl -s http://$ALB_DNS/health | jq '.status'

# 3. Ready check responds
curl -s http://$ALB_DNS/ready | jq '.status'

# 4. Database connected
curl -s http://$ALB_DNS/ready | jq '.checks.database'

# 5. Logs flowing
aws logs get-log-events \
  --log-group-name "/ecs/unifocus-dev-api" \
  --log-stream-name $(aws logs describe-log-streams --log-group-name "/ecs/unifocus-dev-api" --region us-east-1 --max-items 1 --query 'logStreams[0].logStreamName' --output text) \
  --region us-east-1 | jq '.events | length'
```

### 6.2 Document Findings

Create `deployment-results.md` with:

- Date/time of deployment
- Workflow run ID and duration
- Infrastructure status
- Endpoint response times
- Any errors encountered and resolution
- Deployment sign-off

## Quick Reference Commands

```bash
# Get all infrastructure details
alias ufocus-status='bash -c "
CLUSTER=\$(aws ecs list-clusters --region us-east-1 --query \"clusterArns[0]\" --output text)
SERVICE=\$(aws ecs list-services --cluster \$CLUSTER --region us-east-1 --query \"serviceArns[0]\" --output text)
ALB=\$(aws elbv2 describe-load-balancers --region us-east-1 --query \"LoadBalancers[0]\" --output text)
echo \"Cluster: \$CLUSTER\"
echo \"Service: \$SERVICE\"
aws ecs describe-services --cluster \$CLUSTER --services \$SERVICE --region us-east-1 | jq '.services[0] | {status, desiredCount, runningCount}'
"'

# Watch service status
watch -n 5 'bash -c "
CLUSTER=\$(aws ecs list-clusters --region us-east-1 --query \"clusterArns[0]\" --output text)
SERVICE=\$(aws ecs list-services --cluster \$CLUSTER --region us-east-1 --query \"serviceArns[0]\" --output text)
aws ecs describe-services --cluster \$CLUSTER --services \$SERVICE --region us-east-1 | jq '.services[0] | {status, desiredCount, runningCount, lastUpdateStatus}'
"'

# Tail logs
aws logs tail /ecs/unifocus-dev-api --follow --region us-east-1
```

## Related Documentation

- [Terraform Deployment Guide](./TERRAFORM_DEPLOYMENT.md)
- [Infrastructure Outputs Reference](./TERRAFORM_OUTPUTS.md)
- [Development Guide](./DEVELOPMENT.md)
- [API Documentation](../services/api/README.md)
