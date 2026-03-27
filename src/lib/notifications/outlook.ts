export async function sendOutlookNotification(data: {
  to: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  // Microsoft Graph API email send
  // For v1, this is a placeholder that logs the notification
  // Full MS Graph integration requires OAuth token flow
  console.log('[Outlook] Would send email:', data);
  return true;
}
