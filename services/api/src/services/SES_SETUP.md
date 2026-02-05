# AWS SES Email Setup Guide

This service uses **AWS SES (Simple Email Service)** for sending invite emails. SES was chosen for being the most cost-effective ($0.10 per 1,000 emails) and enterprise-ready solution.

## Prerequisites

1. **AWS Account** with SES access
2. **Verified email address or domain** in SES
3. **AWS credentials** configured

## Cost Breakdown

- **Free tier**: 62,000 emails/month (when sent from EC2)
- **Pay-as-you-go**: $0.10 per 1,000 emails
- **No minimum fees** or monthly commitments

## Setup Steps

### 1. Verify Your Email Address/Domain in SES

**Option A: Verify a single email (for testing)**

```bash
aws ses verify-email-identity --email-address noreply@unifocus.com
```

Then check your inbox and click the verification link.

**Option B: Verify a domain (for production)**

```bash
aws ses verify-domain-identity --domain unifocus.com
```

Add the TXT record to your DNS settings.

Check verification status:

```bash
aws ses list-verified-email-addresses
# or
aws ses list-identities
```

### 2. Request Production Access (Remove Sandbox Limits)

By default, SES starts in **sandbox mode**:

- Can only send to verified email addresses
- Limited to 200 emails/day

To send to any email address:

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Click "Account dashboard" → "Request production access"
3. Fill out the form (usually approved within 24 hours)

### 3. Configure AWS Credentials

**Option A: Use environment variables**

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

**Option B: Use AWS credentials file** (`~/.aws/credentials`)

```ini
[default]
aws_access_key_id = your_access_key
aws_secret_access_key = your_secret_key
```

**Option C: Use IAM roles** (recommended for EC2/ECS)

- Attach IAM role with `ses:SendEmail` permission to your instance

### 4. Set Environment Variables

Add to your `.env` file:

```bash
# Required
FROM_EMAIL=noreply@unifocus.com  # Must be verified in SES
USE_REAL_EMAIL=true              # Set to 'true' to enable SES

# Optional (defaults shown)
AWS_SES_REGION=us-east-1         # SES region
WEB_LOGIN_URL=https://app.unifocus.com/login
MOBILE_IOS_URL=https://apps.apple.com/app/unifocus
MOBILE_ANDROID_URL=https://play.google.com/store/apps/details?id=com.unifocus
```

### 5. IAM Policy for SES

Minimum required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

## Development vs Production

### Development Mode (Default)

```bash
USE_REAL_EMAIL=false  # or unset
```

- Emails logged to console only
- No actual emails sent
- No AWS credentials needed

### Production Mode

```bash
USE_REAL_EMAIL=true
```

- Real emails sent via SES
- AWS credentials required
- FROM_EMAIL must be verified in SES

## Testing the Setup

### 1. Send a test email via AWS CLI

```bash
aws ses send-email \
  --from noreply@unifocus.com \
  --destination ToAddresses=test@example.com \
  --message Subject={Data="Test"},Body={Text={Data="Test message"}}
```

### 2. Check SES sending statistics

```bash
aws ses get-send-statistics
```

### 3. Test from the application

Create a new user via the User Administration page - check the API logs for:

- Dev mode: `[Invite Email - Dev Mode]`
- Production: `[Invite Email - Sent via SES]`

## Troubleshooting

### Error: "Email address is not verified"

- Verify the FROM_EMAIL address in SES console
- Wait for verification email and click the link

### Error: "MessageRejected: Email address is not verified"

- You're in sandbox mode and trying to send to unverified recipient
- Either verify the recipient email OR request production access

### Error: "Missing credentials in config"

- Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
- Or configure ~/.aws/credentials
- Or use IAM role (if running on AWS)

### Error: "Account sending paused"

- Check SES reputation dashboard
- May need to contact AWS support

### Emails going to spam

1. Set up SPF record:
   ```
   v=spf1 include:amazonses.com ~all
   ```
2. Set up DKIM (auto-generated in SES console)
3. Set up DMARC record
4. Use your verified domain for FROM_EMAIL

## Monitoring

### CloudWatch Metrics

SES automatically publishes metrics to CloudWatch:

- `Send` - Successful sends
- `Bounce` - Bounced emails
- `Complaint` - Spam complaints
- `Reject` - Rejected by SES

### Logs

Check application logs for:

```
[Invite Email - Sent via SES] { to: 'user@example.com', inviteType: 'web' }
[Invite Email - SES Error] { error: '...' }
```

## Email Templates

The service sends HTML + plain text emails:

- **Web users**: Button to sign in at WEB_LOGIN_URL
- **Mobile-only (Employee role)**: Buttons for iOS/Android app stores

Templates are in [invite-email.ts](./invite-email.ts) - customize as needed.

## Production Checklist

- [ ] Domain verified in SES
- [ ] Production access approved (out of sandbox)
- [ ] SPF/DKIM/DMARC configured
- [ ] IAM role/credentials configured
- [ ] FROM_EMAIL matches verified domain
- [ ] USE_REAL_EMAIL=true in production .env
- [ ] CloudWatch alarms set up for bounces/complaints
- [ ] Test email sending works

## Cost Estimation

Examples based on $0.10 per 1,000 emails:

| Monthly Users | Emails/User | Total Emails | Cost   |
| ------------- | ----------- | ------------ | ------ |
| 100           | 5           | 500          | $0.05  |
| 1,000         | 5           | 5,000        | $0.50  |
| 10,000        | 5           | 50,000       | $5.00  |
| 100,000       | 5           | 500,000      | $50.00 |

**Note**: First 62,000 emails/month are free if sent from EC2/ECS.
