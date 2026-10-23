const env = require('../config/env');

// Keep outbound messages to one GSM segment (160 chars) to protect the SMS budget.
const clip = (s) => (s.length > 160 ? `${s.slice(0, 157)}...` : s);

async function sendSms(to, message) {
  const body = clip(message);

  if (env.SMS_PROVIDER === 'console') {
    console.log(`[SMS -> ${to}] ${body}`);
    return;
  }

  if (env.SMS_PROVIDER === 'termii') {
    // Verify payload/endpoint against your provider's current docs before go-live.
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.replace('+', ''),
        from: env.TERMII_SENDER_ID,
        sms: body,
        type: 'plain',
        channel: 'generic',
        api_key: env.TERMII_API_KEY,
      }),
    });
    if (!res.ok) throw new Error(`SMS provider responded ${res.status}`);
  }
}

// Never let a failed SMS break a request.
async function safeSendSms(to, message) {
  try {
    await sendSms(to, message);
  } catch (e) {
    console.error('SMS send failed:', e.message);
  }
}

module.exports = { safeSendSms };
