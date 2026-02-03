# Deployment Quick Reference Card

## 🚀 One-Liner Start (On Local Machine with AWS Setup)

```bash
./scripts/terraform-deploy.sh dev && \
gh secret set AWS_ROLE_ARN --repo krisballew/Unifocus-Simple --body "$(aws sts get-caller-identity --query 'Account' --output text)" && \
gh workflow run deploy-api-dev.yml --repo krisballew/Unifocus-Simple && \
gh workflow run deploy-web-dev.yml --repo krisballew/Unifocus-Simple --ref main
```

## ⏱️ Timeline

| Step      | Task                            | Time          | Owner          |
| --------- | ------------------------------- | ------------- | -------------- |
| 1         | Deploy Terraform infrastructure | 15 min        | You            |
| 2         | Configure 11 GitHub secrets     | 5 min         | You            |
| 3         | API deployment workflow         | 10 min        | GitHub Actions |
| 4         | Verify API endpoints            | 5-10 min      | You            |
| 5         | Web deployment workflow         | 3 min         | GitHub Actions |
| 6         | Verify web app + auth           | 10-15 min     | You            |
| **Total** | **Complete deployment**         | **50-60 min** |                |

## 🔑 11 GitHub Secrets Needed

### API Secrets (From Terraform outputs)

```
AWS_ROLE_ARN               = arn:aws:iam::ACCOUNT:role/unifocus-github-actions-dev
ECR_REPOSITORY_NAME        = unifocus-api
ECS_CLUSTER_NAME           = unifocus-dev-cluster
ECS_SERVICE_NAME           = unifocus-dev-api-service
ECS_TASK_FAMILY            = unifocus-dev-api
```

### Web Secrets (From Terraform outputs + Cognito)

```
VITE_API_BASE_URL          = http://ALB_DNS
VITE_COGNITO_REGION        = us-east-1
VITE_COGNITO_USER_POOL_ID  = us-east-1_XXXXXXX
VITE_COGNITO_CLIENT_ID     = alphanumeric
VITE_COGNITO_DOMAIN        = unifocus-dev.auth.us-east-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI  = https://CLOUDFRONT/auth/callback
VITE_COGNITO_LOGOUT_URI    = https://CLOUDFRONT/login
WEB_BUCKET_NAME            = unifocus-dev-web-XXXXXXX
CLOUDFRONT_DISTRIBUTION_ID = XXXXXXXXXXXXX
CLOUDFRONT_DOMAIN          = dXXXXXXXX.cloudfront.net
```

## 📋 Deploy Checklist

- [ ] **Prerequisites**
  - [ ] Terraform >= 1.5.0 installed
  - [ ] AWS CLI >= 2.0 installed
  - [ ] AWS credentials configured
  - [ ] GitHub CLI installed
  - [ ] Docker installed

- [ ] **Infrastructure**
  - [ ] Run `./scripts/terraform-deploy.sh dev`
  - [ ] Capture Terraform outputs
  - [ ] Verify AWS resources created

- [ ] **GitHub Configuration**
  - [ ] Set 11 secrets in repository
  - [ ] Verify all secrets are set: `gh secret list`

- [ ] **API Deployment**
  - [ ] Trigger workflow: `gh workflow run deploy-api-dev.yml`
  - [ ] Monitor workflow progress
  - [ ] Verify API `/health` returns 200
  - [ ] Verify API `/ready` returns 200

- [ ] **Web Deployment**
  - [ ] Trigger workflow: `gh workflow run deploy-web-dev.yml`
  - [ ] Monitor workflow progress
  - [ ] Verify CloudFront distribution status
  - [ ] Verify app loads without errors

- [ ] **Manual Testing**
  - [ ] Open app in browser
  - [ ] Test login flow (Cognito)
  - [ ] Test authenticated API calls
  - [ ] Check browser console (no errors)
  - [ ] Check security headers: `curl -I https://cloudfront/`

## 🔍 Quick Verification Commands

```bash
# Get infrastructure values
terraform output -json | jq '.api_url, .cloudfront_url'

# Check API health
curl https://<ALB_DNS>/health
curl https://<ALB_DNS>/ready

# Check web loads
curl -I https://<CLOUDFRONT_DOMAIN>/

# Verify security headers
curl -s -I https://<CLOUDFRONT_DOMAIN>/ | grep -E "strict|cache|csp"

# Monitor workflows
gh run list --repo krisballew/Unifocus-Simple --limit 3

# Check logs
aws logs tail /ecs/unifocus-dev-api --follow

# Check ECS status
aws ecs describe-services --cluster unifocus-dev-cluster --services unifocus-dev-api-service \
  --region us-east-1 | jq '.services[0] | {status, desiredCount, runningCount}'
```

## 🐛 Quick Troubleshooting

| Issue              | Command                                    |
| ------------------ | ------------------------------------------ |
| API won't start    | `aws logs tail /ecs/unifocus-dev-api`      |
| Health check fails | `curl https://<ALB>/ready`                 |
| Web won't load     | `curl -I https://<CF>/`                    |
| CORS error         | Check ALB security group allows CloudFront |
| Auth fails         | Check VITE*COGNITO*\* secrets are set      |
| Stale config       | Hard refresh browser (Ctrl+Shift+R)        |

## 📚 Full Documentation

Start here based on your need:

- **First-time deployment?** → [COMPLETE_DEPLOYMENT_GUIDE.md](./COMPLETE_DEPLOYMENT_GUIDE.md)
- **Infrastructure questions?** → [TERRAFORM_DEPLOYMENT.md](./TERRAFORM_DEPLOYMENT.md)
- **API not working?** → [DEPLOYMENT_VERIFICATION_GUIDE.md](./DEPLOYMENT_VERIFICATION_GUIDE.md)
- **Web not working?** → [WEB_DEPLOYMENT_VERIFICATION_GUIDE.md](./WEB_DEPLOYMENT_VERIFICATION_GUIDE.md)
- **Status check?** → [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)

## 🎯 Success Criteria

✅ Deployment successful when:

- API `/health` responds with 200
- API `/ready` responds with 200 (database ok)
- Web app loads without errors
- Cognito login works
- Authenticated API calls work
- No CORS errors in console
- CloudFront has security headers
- CloudWatch logs show activity

## 🆘 Need Help?

1. Check the full guide: [COMPLETE_DEPLOYMENT_GUIDE.md](./COMPLETE_DEPLOYMENT_GUIDE.md)
2. Review verification guide for your component
3. Check AWS CloudWatch logs for error details
4. Review GitHub workflow logs for build issues

---

**Status:** ✅ Ready to Deploy  
**Last Updated:** February 3, 2026
