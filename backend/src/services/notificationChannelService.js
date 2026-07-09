import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const notificationTemplateService = createCrudService('notificationTemplate', {
  searchFields: ['name', 'eventType'],
  moduleName: 'hr',
  entityLabel: 'Notification Template',
  softDelete: false,
});

// ── Provider adapters ─────────────────────────────────────────────────────────

async function sendViaTwilio(to, body, config) {
  if (!config?.TWILIO_ACCOUNT_SID || !config?.TWILIO_AUTH_TOKEN || !config?.TWILIO_FROM) {
    console.log(`[Twilio STUB] SMS to ${to}: ${body}`);
    return { provider: 'twilio', status: 'stub', to, body };
  }
  const basicAuth = Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: config.TWILIO_FROM, Body: body });
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'Twilio send failed');
  return { provider: 'twilio', status: 'sent', to, sid: data.sid };
}

async function sendViaMSG91(to, body, config) {
  if (!config?.MSG91_AUTHKEY) {
    console.log(`[MSG91 STUB] SMS to ${to}: ${body}`);
    return { provider: 'msg91', status: 'stub', to };
  }
  const resp = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: config.MSG91_AUTHKEY },
    body: JSON.stringify({
      // Plain-text fallback flow; if you have a DLT-approved template flow_id, set it via MSG91_FLOW_ID instead.
      sender: config.MSG91_SENDER_ID || 'MEDCOR',
      mobiles: to.replace(/^\+/, ''),
      body,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.message || 'MSG91 send failed');
  return { provider: 'msg91', status: 'sent', to };
}

async function sendViaWhatsApp(to, body, config) {
  if (!config?.WHATSAPP_TOKEN || !config?.WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[WhatsApp STUB] Message to ${to}: ${body}`);
    return { provider: 'whatsapp', status: 'stub', to };
  }
  // Meta WhatsApp Cloud API — free-form text messages require an open 24h
  // customer-initiated session; outside that window use an approved template
  // via WHATSAPP_TEMPLATE_NAME instead of raw body text.
  const resp = await fetch(`https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error?.message || 'WhatsApp send failed');
  return { provider: 'whatsapp', status: 'sent', to, messageId: data.messages?.[0]?.id };
}

let _mailTransport = null;
async function getMailTransport(config) {
  if (_mailTransport) return _mailTransport;
  const { default: nodemailer } = await import('nodemailer');
  _mailTransport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: Number(config.SMTP_PORT || 587),
    secure: Number(config.SMTP_PORT) === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return _mailTransport;
}

async function sendViaEmail(to, subject, body, config) {
  if (!config?.SMTP_HOST) {
    console.log(`[Email STUB] To: ${to} | Subject: ${subject}`);
    return { provider: 'email', status: 'stub', to };
  }
  const transport = await getMailTransport(config);
  const info = await transport.sendMail({ from: config.SMTP_FROM || config.SMTP_USER, to, subject, html: body });
  return { provider: 'email', status: 'sent', to, messageId: info.messageId };
}

// ── Core send function ────────────────────────────────────────────────────────

export async function sendNotification(req, {
  channel, recipient, subject, body, templateId = null,
  entityType = null, entityId = null,
}) {
  // Load tenant config (stored in tenant settings or env)
  const tenantConfig = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM: process.env.TWILIO_FROM,
    MSG91_AUTHKEY: process.env.MSG91_AUTHKEY,
    MSG91_SENDER_ID: process.env.MSG91_SENDER_ID,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
  };

  let result;
  let status = 'Sent';
  let errorMsg = null;

  try {
    if (channel === 'SMS') result = await sendViaMSG91(recipient, body, tenantConfig);
    else if (channel === 'WhatsApp') result = await sendViaWhatsApp(recipient, body, tenantConfig);
    else if (channel === 'Email') result = await sendViaEmail(recipient, subject, body, tenantConfig);
    else {
      console.log(`[Push STUB] To ${recipient}: ${body}`);
      result = { provider: 'push', status: 'stub' };
    }
    if (result.status === 'stub') status = 'Queued'; // logged only — no real provider configured yet
    else status = 'Sent';
  } catch (err) {
    status = 'Failed';
    errorMsg = err.message;
  }

  const log = await prisma.notificationLog.create({
    data: {
      tenantId: req.tenantId,
      templateId: templateId ? BigInt(templateId) : null,
      channel,
      recipient,
      subject: subject || null,
      body,
      status,
      errorMsg,
      sentAt: status !== 'Failed' ? new Date() : null,
      entityType: entityType || null,
      entityId: entityId ? BigInt(entityId) : null,
    },
  });

  return { log, result };
}

// ── Event-driven helpers ──────────────────────────────────────────────────────

export async function fireEventNotifications(req, eventType, variables = {}, entityType = null, entityId = null) {
  const templates = await prisma.notificationTemplate.findMany({
    where: { tenantId: req.tenantId, eventType, isActive: true },
  });

  const results = [];
  for (const tpl of templates) {
    let body = tpl.body;
    let subject = tpl.subject || '';
    for (const [k, v] of Object.entries(variables)) {
      body = body.replace(new RegExp(`{{${k}}}`, 'g'), v);
      subject = subject.replace(new RegExp(`{{${k}}}`, 'g'), v);
    }

    const recipient = variables.phone || variables.email || variables.to;
    if (!recipient) continue;

    results.push(await sendNotification(req, {
      channel: tpl.channel,
      recipient,
      subject,
      body,
      templateId: tpl.id,
      entityType,
      entityId,
    }));
  }

  return results;
}

// ── List logs ─────────────────────────────────────────────────────────────────

export async function listLogs(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.channel) where.channel = filters.channel;
  if (filters.status) where.status = filters.status;
  if (filters.entityType) where.entityType = filters.entityType;

  const [items, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      include: { template: { select: { id: true, name: true, eventType: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notificationLog.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getNotificationStats(req) {
  const [total, sent, failed, queued] = await Promise.all([
    prisma.notificationLog.count({ where: { tenantId: req.tenantId } }),
    prisma.notificationLog.count({ where: { tenantId: req.tenantId, status: { in: ['Sent', 'Delivered'] } } }),
    prisma.notificationLog.count({ where: { tenantId: req.tenantId, status: 'Failed' } }),
    prisma.notificationLog.count({ where: { tenantId: req.tenantId, status: 'Queued' } }),
  ]);
  return { total, sent, failed, queued };
}
