export async function sendSlackNotification(data: {
  requestTitle: string;
  urgency: string;
  creativeCount: number;
  approvalUrl: string;
  designerUrl: string;
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `New Package Ready: ${data.requestTitle}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Urgency:* ${data.urgency}\n*Creatives:* ${data.creativeCount} variants\n<${data.approvalUrl}|Review & Approve> | <${data.designerUrl}|Designer Download>`,
          },
        },
      ],
    }),
  });
  return response.ok;
}
