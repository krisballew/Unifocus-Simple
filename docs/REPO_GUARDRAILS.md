# Repository Guardrails

This document describes recommended GitHub branch protection rules, code review policies, and automation guardrails to maintain code quality and prevent production incidents.

**Note**: The following recommendations cannot be enforced by automation and must be configured manually in GitHub repository settings by an administrator.

---

## GitHub Branch Protection Settings

### Required Configuration for `main` Branch

**Location**: Settings → Branches → Branch protection rules → `main`

#### 1. Require Pull Request Reviews

```
✅ Require pull request reviews before merging
   - Required number of approvals: 2
   - Require review from code owners: Yes
   - Dismiss stale pull request approvals when new commits are pushed: Yes
   - Require approval of the most recent reviewable push: Yes
```

**Rationale**: Prevents single-point-of-failure code review. Two independent eyes catch security issues and logic bugs.

#### 2. Require Status Checks to Pass

```
✅ Require status checks to pass before merging
   - Require branches to be up to date before merging: Yes

✅ Require passing status checks:
   - build
   - test
   - lint
   - security-scan
   - typecheck
   - e2e-smoke-test
```

**Status Check Requirements**:

| Check            | Purpose                     | Failure Reason         |
| ---------------- | --------------------------- | ---------------------- |
| `build`          | Builds TypeScript/web app   | Compilation errors     |
| `test`           | Runs unit/integration tests | Failed test case       |
| `lint`           | Runs ESLint                 | Code style violations  |
| `security-scan`  | SAST scan (Snyk/SonarQube)  | Security vulnerability |
| `typecheck`      | TypeScript type checking    | Type errors            |
| `e2e-smoke-test` | Smoke tests on staging      | Critical path broken   |

#### 3. Require Code Owner Review

```
✅ Require a review from code owners
   - Code owners file: .github/CODEOWNERS
```

**CODEOWNERS Configuration** (`CODEOWNERS` file in repo root):

```
# Infrastructure & Deployment
infra/                          @krisballew/backend-team
.github/workflows/              @krisballew/backend-team
scripts/                        @krisballew/backend-team

# API Service
services/api/                   @krisballew/backend-team
services/api/src/auth/          @krisballew/security-team
services/api/src/routes/        @krisballew/backend-team
services/api/tests/             @krisballew/backend-team

# Web Frontend
apps/web/                       @krisballew/frontend-team
apps/web/src/components/        @krisballew/frontend-team

# Documentation
docs/                           @krisballew/all-developers
*.md                            @krisballew/all-developers

# Security-sensitive files
services/api/prisma/schema.prisma  @krisballew/security-team
services/api/src/auth/          @krisballew/security-team
.env.example                    @krisballew/security-team
```

#### 4. Require Signed Commits

```
✅ Require commit signatures
   - Dismiss stale reviews upon push: Yes
```

**Implementation**:

- All developers configure GPG signing: `git config --global commit.gpgsign true`
- SSH key signing (GitHub allows signing with SSH keys)

#### 5. Restrict Force Push

```
✅ Restrict who can force push to matching branches
   - Allow force pushes to matching branches: No
```

#### 6. Require Linear History

```
✅ Require a linear history
```

**Note**: Enables clean history, easier bisect/revert.

#### 7. Require Conversations to be Resolved

```
✅ Require all conversations on pull requests to be resolved before merging
```

---

## Pull Request Requirements

### PR Template (`pull_request_template.md`)

```markdown
## Description

<!-- Brief description of changes -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Infrastructure/DevOps
- [ ] Documentation

## Testing

- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing completed
- [ ] E2E tests passing

## Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where non-obvious
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] Tests pass locally: `pnpm test`

## Security Checklist

- [ ] No credentials/secrets committed
- [ ] No SQL injection vulnerabilities
- [ ] Tenant scoping verified (no data leakage)
- [ ] Rate limiting considered
- [ ] Input validation implemented

## Related Issues

Closes #(issue number)
```

### PR Title Requirements

**Format**: `[type]: description`

**Valid Types**:

- `fix:` - Bug fix
- `feat:` - New feature
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Test addition/fix
- `docs:` - Documentation
- `chore:` - Build/CI/dependency update
- `sec:` - Security fix

**Examples**:

- ✅ `feat: Add punch idempotency support`
- ✅ `fix: Prevent cross-tenant data leakage in schedule query`
- ✅ `sec: Update JSON Web Token verification library`
- ✅ `docs: Add production readiness gate checklist`
- ❌ `Update stuff` (too vague)
- ❌ `WIP` (merge in progress)

---

## Code Review Checklist

**All reviews must verify**:

### Functionality & Logic

- [ ] Code does what the PR description claims
- [ ] Logic is sound and edge cases handled
- [ ] No hardcoded values or debugging code left
- [ ] Error handling is comprehensive

### Security

- [ ] No credentials/secrets in code
- [ ] SQL queries parameterized (using Prisma/ORM)
- [ ] **Tenant scoping verified**: All DB queries include `tenantId` filter
- [ ] Input validation present
- [ ] CORS/CSRF protection considered
- [ ] No XXS vulnerabilities in web code
- [ ] Dependencies up-to-date (no known vulnerabilities)

### Testing

- [ ] Tests added for new functionality
- [ ] Tests pass locally
- [ ] Test coverage not decreased (ideally increased)
- [ ] Tests verify happy path AND error cases

### Performance

- [ ] No N+1 queries
- [ ] No unbounded loops or recursion
- [ ] Database indexes considered
- [ ] Large data loads handled efficiently

### Operations

- [ ] Logs added for debugging
- [ ] Metrics/instrumentation considered
- [ ] Deployment strategy considered (blue/green, etc.)
- [ ] Rollback plan feasible

### Documentation

- [ ] README updated if needed
- [ ] API docs/comments added for new endpoints
- [ ] Complex logic documented
- [ ] Deployment instructions clear

### Tenancy Scoping (Critical for Every API Change)

**Mandatory check for all API changes**:

```typescript
// ✅ GOOD - Explicitly scoped to tenant
const schedules = await prisma.schedule.findMany({
  where: {
    tenantId: context.tenantId, // ← ALWAYS REQUIRED
    id: scheduleId,
  },
});

// ❌ BAD - Missing tenantId (REJECT THIS)
const schedules = await prisma.schedule.findMany({
  where: { id: scheduleId }, // ← WILL LEAK DATA
});

// ✅ GOOD - Scoped via relationship validation
const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
if (!schedule || schedule.tenantId !== context.tenantId) {
  throw new Error('Not found');
}
```

**Review Rule**: If a database query doesn't include tenant scoping, the PR is automatically rejected.

---

## Automated Checks

### GitHub Actions Workflows

**Required Status Checks** (configured in `.github/workflows/`):

#### 1. Unit & Integration Tests

**Workflow**: `test.yml`

```yaml
- npm/pnpm install and run tests
- Generate coverage reports
- Fail if coverage < 80%
```

#### 2. Type Checking

**Workflow**: `typecheck.yml`

```yaml
- Run TypeScript compiler
- Generate error report
- Block merge on type errors
```

#### 3. Linting

**Workflow**: `lint.yml`

```yaml
- Run ESLint
- Run Prettier
- Block merge on violations
```

#### 4. Security Scanning

**Workflow**: `security-scan.yml`

```yaml
- npm audit (check dependencies)
- Snyk scan (SAST)
- OWASP dependency check
- Block merge on high-severity issues
```

#### 5. Build Verification

**Workflow**: `build.yml`

```yaml
- Build TypeScript
- Build web app (Vite)
- Block merge on build failures
```

#### 6. E2E Smoke Tests (Staging)

**Workflow**: `e2e-smoke-test.yml`

```yaml
- Deploy to staging
- Run smoke tests against staging
- Block merge if critical path broken
```

### Pre-Commit Hooks (`.husky/`)

**Automatic checks before commit**:

```bash
.husky/pre-commit
  ├─ eslint --fix              (lint staged files)
  └─ prettier --write          (format staged files)

.husky/pre-push
  ├─ typecheck                 (verify types)
  ├─ test                      (run tests)
  └─ security checks           (dependency audit)
```

---

## Enforcement Rules

### Rule 1: No Direct Commits to Main

**Enforcement**: Branch protection rule prevents any direct commits to `main`

```
❌ git push origin main          (BLOCKED)
✅ git push origin feature-xyz   (Allowed, requires PR)
```

### Rule 2: All PRs Require Approval

**Enforcement**: GitHub block on status checks

```
Before merge:
- [ ] 2 approvals required
- [ ] Status checks passing
- [ ] Conversations resolved
- [ ] Code owners approved
```

### Rule 3: No Stale Approvals

**Enforcement**: Must be dismissed if new commits added

```
PR approved → Author adds commits → Approvals dismissed
↳ Requires new review before merge
```

### Rule 4: Tenant Scoping Non-Negotiable

**Enforcement**: Code review + automated checks

```
If API changes without tenant scoping:
  ↳ Automatic code review comment
  ↳ PR blocked
  ↳ Security team notification
```

---

## Release Process

### Version Numbering

**Format**: Semantic Versioning (MAJOR.MINOR.PATCH)

- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes

### Release Branches

```
main (stable, deployed to production)
  ↑
  └─ release/v1.2.0 (release candidate)
      ├─ Hotfixes only
      └─ Version bump + release notes

dev (staging, next release)
  ↑
  └─ feature/* (feature branches)
     └─ Create from main
     └─ Merge to dev first
     └─ Then release/ then main
```

### Deployment Gates

**Before deploying main to production**:

```
Checklist:
□ All tests passing on main
□ All status checks green
□ Security scan completed
□ E2E smoke tests passing
□ Staging validated
□ Release notes written
□ Version bumped
□ Product team sign-off
```

---

## Secrets & Credentials

### Never Commit Secrets

**Prevented by**:

- Pre-commit hook: `git-secrets`
- GitHub secret scanning
- SAST scan (Snyk/SonarQube)

**If accidentally committed**:

1. Rotate the credential immediately
2. Remove from history: `git filter-branch`
3. Force push (authorized users only)
4. Incident report filed

### Environment Variables

**Pattern**:

- `.env.example` - Safe example (committed)
- `.env.local` - Local development (gitignored)
- `.env.production` - GitHub Secrets (not in repo)

---

## Escalation & Overrides

### Requiring Override

**Situations that may require override**:

- Critical production hotfix
- Security breach response
- Database corruption recovery

### Override Process

1. **Justification**: Document reason in PR description
2. **Approval**: Requires 2 architect-level approvals
3. **Notification**: Post in #engineering Slack channel
4. **Audit**: Logged in GitHub audit trail

### Example Override PR

```markdown
## OVERRIDE REQUEST: Critical Hotfix

### Justification

Production database corruption affecting 500+ users.
Requires immediate deployment without full test suite.

### Approval Required

- [ ] CTO
- [ ] Engineering Lead

### Risk Mitigation

- [ ] Tested manually on production data snapshot
- [ ] Rollback plan validated
- [ ] Monitoring enhanced for this change
```

---

## Monitoring & Compliance

### Compliance Checks

**Monthly review**:

- [ ] Review all overrides
- [ ] Check merge activity and approval times
- [ ] Verify security scans ran
- [ ] Audit log review

### Metrics to Track

| Metric                      | Target      | Tool           |
| --------------------------- | ----------- | -------------- |
| PR merge time               | < 24h       | GitHub         |
| Code review time            | < 4h        | GitHub         |
| Test pass rate              | > 99%       | GitHub Actions |
| Security issues found/fixed | Track trend | Snyk           |
| Production incidents        | < 1/month   | PagerDuty      |

---

## Related Documentation

- [Production Readiness Gate](./PROD_READINESS_GATE.md)
- [E2E Smoke Test](./E2E_SMOKE_TEST.md)
- [Security Baseline](./SECURITY_BASELINE.md)
- [Deployment Verification Guide](./DEPLOYMENT_VERIFICATION_GUIDE.md)

---

## Implementation Checklist

**To implement these guardrails**:

- [ ] Contact GitHub admin to enable branch protection
- [ ] Create/update `.github/CODEOWNERS` file
- [ ] Create/update `.github/pull_request_template.md`
- [ ] Set up GitHub Actions workflows
- [ ] Configure Snyk/SonarQube for security scanning
- [ ] Install `git-secrets` pre-commit hook
- [ ] Train team on branch protection rules
- [ ] Document override approval process
- [ ] Schedule monthly compliance review
- [ ] Monitor PR metrics dashboard

---

## Version History

| Date       | Status     | Changes                        |
| ---------- | ---------- | ------------------------------ |
| 2026-02-03 | ✅ Initial | Guardrails baseline documented |
