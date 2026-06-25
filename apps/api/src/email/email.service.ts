import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer, { type Transporter } from 'nodemailer';

const OUTBOX_DIR = process.env.EMAIL_OUTBOX_DIR ?? '/tmp/droptrack-outbox';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private stubbed: boolean;
  private readonly fromAddress: string;

  constructor() {
    this.fromAddress = process.env.SES_FROM_EMAIL ?? 'welcome@droptrack.au';

    /**
     * Real SES is opt-in: we require an explicit `AWS_SES_REGION` (not the
     * generic AWS_REGION) so a partly-configured local box defaults to STUB
     * instead of crashing at boot.
     */
    const region = process.env.AWS_SES_REGION;
    if (!region) {
      this.stubbed = true;
      this.logger.warn(
        'AWS_SES_REGION not set — email runs in STUB mode (writes to /tmp/droptrack-outbox).',
      );
      if (!existsSync(OUTBOX_DIR)) mkdirSync(OUTBOX_DIR, { recursive: true });
    } else {
      try {
        const ses = new SESv2Client({ region });
        this.transporter = nodemailer.createTransport({
          SES: { sesClient: ses, SendEmailCommand },
        });
        this.stubbed = false;
        this.logger.log(`SES email enabled · region=${region} · from=${this.fromAddress}`);
      } catch (err) {
        this.stubbed = true;
        this.logger.warn(
          `SES init failed (${(err as Error).message}) — falling back to STUB mode.`,
        );
        if (!existsSync(OUTBOX_DIR)) mkdirSync(OUTBOX_DIR, { recursive: true });
      }
    }
  }

  /**
   * Send the AI Campaign Report as an email with the PDF attached.
   * In STUB mode, writes the email metadata + a copy of the PDF to /tmp/droptrack-outbox.
   */
  async sendCampaignReport(params: {
    to: string;
    clientName: string;
    jobCode: string;
    jobTitle: string;
    narrative: string;
    pdfPath: string;
    pdfFilename: string;
  }) {
    const { to, clientName, jobCode, jobTitle, narrative, pdfPath, pdfFilename } = params;

    const subject = `Your DropTrack campaign report — ${jobTitle}`;
    const text = renderText({ clientName, jobCode, jobTitle, narrative });
    const html = renderHtml({ clientName, jobCode, jobTitle, narrative });

    if (this.stubbed || !this.transporter) {
      // Write a record to the outbox folder for inspection.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const meta = {
        sentAt: new Date().toISOString(),
        from: this.fromAddress,
        to,
        subject,
        pdfAttachment: pdfFilename,
      };
      writeFileSync(join(OUTBOX_DIR, `${stamp}-${jobCode}.json`), JSON.stringify(meta, null, 2));
      writeFileSync(join(OUTBOX_DIR, `${stamp}-${jobCode}.txt`), text);
      this.logger.log(`STUB email written to ${OUTBOX_DIR} (subject: ${subject})`);
      return { stubbed: true, messageId: `stub-${stamp}` };
    }

    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      text,
      html,
      attachments: [{ filename: pdfFilename, path: pdfPath, contentType: 'application/pdf' }],
    });
    this.logger.log(`SES email sent: ${info.messageId}`);
    return { stubbed: false, messageId: info.messageId };
  }
}

function renderText({
  clientName,
  jobCode,
  jobTitle,
  narrative,
}: {
  clientName: string;
  jobCode: string;
  jobTitle: string;
  narrative: string;
}) {
  return `Hi ${clientName},

Your DropTrack campaign "${jobTitle}" (${jobCode}) is complete. The full AI-generated report is attached as a PDF.

A short summary:

${narrative}

Reply to this email if anything looks off and a human will get back to you.

— The DropTrack team
Sydney, Australia · droptrack.au
`;
}

function renderHtml({
  clientName,
  jobCode,
  jobTitle,
  narrative,
}: {
  clientName: string;
  jobCode: string;
  jobTitle: string;
  narrative: string;
}) {
  const paras = narrative
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;color:#4B5161;">${escapeHtml(p)}</p>`)
    .join('');
  return `<!doctype html>
<html><body style="background:#F8F9FB;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDEEF1;">
    <tr>
      <td style="background:#1A1B36;padding:22px 28px;color:#fff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#A3E635;text-transform:uppercase;">DropTrack</div>
        <div style="font-size:18px;font-weight:700;margin-top:6px;">AI Campaign Report</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <h1 style="margin:0 0 6px;font-size:22px;letter-spacing:-0.02em;">${escapeHtml(jobTitle)}</h1>
        <div style="font-size:13px;color:#8B92A4;margin-bottom:22px;">${escapeHtml(jobCode)}</div>

        <p style="margin:0 0 18px;color:#0B0D12;">Hi ${escapeHtml(clientName)},</p>
        <p style="margin:0 0 18px;color:#0B0D12;">Your campaign is complete — here&rsquo;s the short version. The full breakdown is attached as a PDF.</p>

        ${paras}

        <div style="margin-top:24px;padding:14px 16px;background:#EEF2FF;border-radius:12px;font-size:13px;color:#3730A3;">
          PDF report attached &middot; verified GPS audit included
        </div>

        <p style="margin:24px 0 0;font-size:13px;color:#8B92A4;">— The DropTrack team<br>Sydney, Australia &middot; droptrack.au</p>
      </td>
    </tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
