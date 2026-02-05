import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

type InviteType = 'mobile' | 'web';

interface SendInviteOptions {
  name: string;
  email: string;
  roles: string[];
  inviteToken?: string; // Optional invite token for registration
}

interface InvitePayload {
  inviteType: InviteType;
  loginUrl?: string;
  iosAppUrl?: string;
  androidAppUrl?: string;
  registerUrl?: string; // Registration URL with token
}

const LOGIN_URL = process.env['WEB_LOGIN_URL'] ?? 'https://app.unifocus.com/login';
const IOS_APP_URL =
  process.env['MOBILE_IOS_URL'] ?? 'https://apps.apple.com/app/unifocus-placeholder';
const ANDROID_APP_URL =
  process.env['MOBILE_ANDROID_URL'] ??
  'https://play.google.com/store/apps/details?id=com.unifocus.placeholder';

// SES Configuration
const SES_REGION = process.env['AWS_SES_REGION'] ?? 'us-east-1';
const FROM_EMAIL = process.env['FROM_EMAIL'] ?? 'noreply@unifocus.com';
const USE_REAL_EMAIL = process.env['USE_REAL_EMAIL'] === 'true';

const sesClient = new SESClient({ region: SES_REGION });

export function buildInvitePayload(roles: string[], inviteToken?: string): InvitePayload {
  const isEmployeeOnly = roles.length === 1 && roles.includes('Employee');
  const registerUrl = inviteToken ? `${LOGIN_URL}/register?token=${inviteToken}` : undefined;

  if (isEmployeeOnly) {
    return {
      inviteType: 'mobile',
      iosAppUrl: IOS_APP_URL,
      androidAppUrl: ANDROID_APP_URL,
      registerUrl,
    };
  }

  return {
    inviteType: 'web',
    loginUrl: LOGIN_URL,
    registerUrl,
  };
}

function buildEmailHtml(name: string, payload: InvitePayload): string {
  const greeting = name ? `Hello ${name},` : 'Hello,';

  if (payload.inviteType === 'mobile') {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; margin: 10px 5px;
                      background-color: #007bff; color: white; text-decoration: none;
                      border-radius: 4px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;
                      font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${greeting}</h2>
            <p>You've been invited to join Unifocus!</p>
            <p>Download the mobile app to get started:</p>
            <div>
              <a href="${payload.iosAppUrl}" class="button">Download for iOS</a>
              <a href="${payload.androidAppUrl}" class="button">Download for Android</a>
            </div>
            ${payload.registerUrl ? `<p style="margin-top: 20px; font-size: 14px; color: #666;">Or complete your registration: <a href="${payload.registerUrl}">Set up your account</a></p>` : ''}
            <div class="footer">
              <p>If you have any questions, please contact your administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 0;
                    background-color: #007bff; color: white; text-decoration: none;
                    border-radius: 4px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;
                    font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${greeting}</h2>
          <p>You've been invited to join Unifocus!</p>
          <p>Click the button below to complete your registration and set your password:</p>
          <a href="${payload.registerUrl}" class="button">Complete Registration</a>
          <div class="footer">
            <p>This invitation link will expire in 7 days.</p>
            <p>If you have any questions, please contact your administrator.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildEmailText(name: string, payload: InvitePayload): string {
  const greeting = name ? `Hello ${name},` : 'Hello,';

  if (payload.inviteType === 'mobile') {
    let text = `${greeting}\n\nYou've been invited to join Unifocus!\n\nDownload the mobile app:\niOS: ${payload.iosAppUrl}\nAndroid: ${payload.androidAppUrl}`;
    if (payload.registerUrl) {
      text += `\n\nOr complete your registration online: ${payload.registerUrl}`;
    }
    text += '\n\nIf you have any questions, please contact your administrator.';
    return text;
  }

  return `${greeting}\n\nYou've been invited to join Unifocus!\n\nComplete your registration and set your password:\n${payload.registerUrl}\n\nThis link will expire in 7 days.\n\nIf you have any questions, please contact your administrator.`;
}

export async function sendInviteEmail(options: SendInviteOptions): Promise<InvitePayload> {
  const payload = buildInvitePayload(options.roles, options.inviteToken);

  const subject = 'Welcome to Unifocus - Your Invitation';
  const htmlBody = buildEmailHtml(options.name, payload);
  const textBody = buildEmailText(options.name, payload);

  if (!USE_REAL_EMAIL) {
    // Development mode: log to console
    // eslint-disable-next-line no-console
    console.log('[Invite Email - Dev Mode]', {
      to: options.email,
      from: FROM_EMAIL,
      subject,
      roles: options.roles,
      inviteType: payload.inviteType,
      textPreview: textBody.substring(0, 100) + '...',
    });
    return payload;
  }

  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [options.email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await sesClient.send(command);

    // eslint-disable-next-line no-console
    console.log('[Invite Email - Sent via SES]', {
      to: options.email,
      inviteType: payload.inviteType,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Invite Email - SES Error]', {
      error: error instanceof Error ? error.message : String(error),
      to: options.email,
    });
    throw error;
  }

  return payload;
}
