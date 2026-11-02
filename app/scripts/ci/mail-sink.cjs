/* eslint-disable @typescript-eslint/no-require-imports -- a --require preload must be CommonJS */
/**
 * CI only: account mail without a mail provider. Preloaded into `next start`
 * (NODE_OPTIONS="--require ./scripts/ci/mail-sink.cjs") with MAIL_SINK set, it
 * answers @bitbaum/mail-kit's one call, POST https://api.resend.com/emails, by
 * appending the message as one JSON line to MAIL_SINK. Every other request goes
 * out untouched. The browser journey reads the reset and sign-in links from
 * that file, so AccountKit's real token, callback and reset run end to end.
 * Never loaded outside CI: nothing in the app requires it.
 */
const fs = require('node:fs');

const SINK = process.env.MAIL_SINK;
if (SINK) {
  const original = globalThis.fetch;
  globalThis.fetch = async function sinkFetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === 'https://api.resend.com/emails') {
      const body =
        typeof init?.body === 'string' ? init.body : await new Request(input, init).text();
      fs.appendFileSync(SINK, body.replace(/\n/g, ' ') + '\n');
      return new Response(JSON.stringify({ id: `ci-${Date.now()}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return original(input, init);
  };
}
