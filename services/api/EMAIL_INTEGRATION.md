# Email Integration Summary

## Implementation Complete ✅

AWS SES has been integrated for enterprise-ready, cost-effective email delivery.

## What Changed

### 1. Dependencies Added

- `@aws-sdk/client-ses` - AWS SDK for Simple Email Service

### 2. Files Updated

- [services/api/src/services/invite-email.ts](../src/services/invite-email.ts)
  - Full SES integration with HTML/text email templates
  - Dual mode: dev (console logs) and production (real emails)
  - Role-based email content (mobile vs web invites)
- [services/api/.env.example](../.env.example)
  - Added SES configuration variables
  - Added email URL configuration

### 3. Documentation Created

- [SES_SETUP.md](./SES_SETUP.md) - Complete setup guide with:
  - Prerequisites and AWS setup steps
  - Cost breakdown and estimation
  - Development vs production configuration
  - Troubleshooting guide
  - Production checklist

## How It Works

### Development Mode (Default)

```bash
USE_REAL_EMAIL=false  # or unset
```

- Emails logged to console only
- No AWS credentials needed
- Same as before (backward compatible)

### Production Mode

```bash
USE_REAL_EMAIL=true
FROM_EMAIL=noreply@unifocus.com
AWS_SES_REGION=us-east-1
```

- Real emails sent via AWS SES
- Requires AWS credentials
- FROM_EMAIL must be verified in SES

## Email Templates

### Web Users (Non-Employee roles)

- HTML email with branded button
- Links to `WEB_LOGIN_URL`
- Professional styling

### Mobile Users (Employee-only role)

- HTML email with iOS/Android buttons
- Links to app stores
- Same professional styling

## Cost & Scale

**AWS SES Pricing:**

- Free tier: 62,000 emails/month (from EC2)
- Beyond free tier: $0.10 per 1,000 emails
- No monthly minimums

**Example costs:**

- 10,000 users × 5 emails = 50,000 emails = $5.00/month
- 100,000 users × 5 emails = 500,000 emails = $50.00/month

**Why SES over competitors:**

- SendGrid: $19.95/month minimum, $0.80-$1.00 per 1,000 at scale
- Mailgun: $0.80 per 1,000, less enterprise-ready
- SES: Best pricing, AWS-native, proven at scale

## Next Steps

### For Local Development

**No action needed** - emails continue logging to console by default.

### For Production Deployment

1. **Verify your email/domain in AWS SES**

   ```bash
   aws ses verify-email-identity --email-address noreply@yourdomain.com
   ```

2. **Request production access** (removes sandbox limits)
   - Go to AWS SES Console → Request production access
   - Usually approved within 24 hours

3. **Set environment variables**

   ```bash
   USE_REAL_EMAIL=true
   FROM_EMAIL=noreply@yourdomain.com
   AWS_SES_REGION=us-east-1
   ```

4. **Configure AWS credentials**
   - IAM role (recommended for ECS/EC2)
   - Or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY

5. **Set up DNS records** (for deliverability)
   - SPF: `v=spf1 include:amazonses.com ~all`
   - DKIM: Auto-configured in SES console
   - DMARC: `v=DMARC1; p=quarantine`

See [SES_SETUP.md](./SES_SETUP.md) for complete production checklist.

## Testing

### Test in development

1. Create a user in User Administration
2. Check API logs for: `[Invite Email - Dev Mode]`
3. See the full email preview in console

### Test in production

1. Set `USE_REAL_EMAIL=true`
2. Create a user with a real email address
3. Check logs for: `[Invite Email - Sent via SES]`
4. Verify email received

## Monitoring

**Application logs:**

```
[Invite Email - Sent via SES] { to: 'user@example.com', inviteType: 'web' }
[Invite Email - SES Error] { error: '...', to: 'user@example.com' }
```

**AWS CloudWatch metrics:**

- Send success/failure
- Bounces
- Complaints
- Delivery rate

## Rollback

If issues occur, simply set:

```bash
USE_REAL_EMAIL=false
```

Service falls back to console logging with zero downtime.
