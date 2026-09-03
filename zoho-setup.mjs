/**
 * One-time Zoho Books setup.
 *
 *   node zoho-setup.mjs
 *
 * Prompts for the client id, client secret and a fresh grant code, then tries each Zoho
 * data centre until one accepts them. A grant code is only valid at the data centre that
 * issued it, so a wrong-centre attempt fails without consuming the code.
 *
 * On success the credentials are written to .env.local (git-ignored). Nothing is echoed
 * back and nothing lands in your shell history.
 */
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ORG_ID = '870791901';

/** Zoho account and API hosts, paired per data centre. */
const DATA_CENTRES = [
  { name: 'India (.in)', accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
  { name: 'US (.com)', accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
  { name: 'Europe (.eu)', accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
  { name: 'Australia (.com.au)', accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
  { name: 'Japan (.jp)', accounts: 'https://accounts.zoho.jp', api: 'https://www.zohoapis.jp' },
];

/** Non-interactive form: node zoho-setup.mjs <clientId> <clientSecret> <code> */
const [argId, argSecret, argCode] = process.argv.slice(2);

let clientId = argId;
let clientSecret = argSecret;
let code = argCode;

const DEFAULT_CLIENT_ID = '1000.PCDPB2H6B7UGC2NT2KY9SYDN2J7ZNW';

// Prompt only for what was not supplied, so a value already to hand need not be retyped.
if (!clientId || !clientSecret || !code) {
  const rl = readline.createInterface({ input, output });

  console.log('\nZoho Books setup');
  console.log('----------------');
  console.log('Org ID:', ORG_ID);
  console.log('\nAll three values must come from the SAME Self Client.\n');

  if (!clientId) {
    clientId = (await rl.question(`Client ID    [${DEFAULT_CLIENT_ID}]: `)).trim() || DEFAULT_CLIENT_ID;
  }
  if (!clientSecret) clientSecret = (await rl.question('Client secret: ')).trim();
  if (!code) code = (await rl.question('Grant code   : ')).trim();
  rl.close();
}

clientId = (clientId || '').trim();
clientSecret = (clientSecret || '').trim();
code = (code || '').trim();

if (!clientId || !clientSecret || !code) {
  console.error('\nAll three values are required. Nothing was written.');
  process.exit(1);
}

const exchange = async (centre) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });
  try {
    const response = await fetch(`${centre.accounts}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return await response.json().catch(() => ({ error: 'unparseable_response' }));
  } catch (error) {
    return { error: `network_error: ${error.message}` };
  }
};

let success = null;
console.log('');
for (const centre of DATA_CENTRES) {
  process.stdout.write(`Trying ${centre.name.padEnd(20)} `);
  const result = await exchange(centre);
  if (result.refresh_token) {
    console.log('accepted.');
    success = { centre, result };
    break;
  }
  console.log(`rejected (${result.error ?? 'unknown'})`);
  // A code is single-use at its own centre; once one centre reports invalid_code the
  // credentials matched there and the code is simply spent. No point trying the rest.
  if (result.error === 'invalid_code') {
    console.log(`\nYour data centre is ${centre.name} - the client credentials were accepted there.`);
    console.log('The code itself was expired or already used. Generate a fresh one and run this again.');
    process.exit(1);
  }
}

if (!success) {
  console.error('\nNo data centre accepted these credentials.');
  console.error('\nCheck, in order:');
  console.error('  1. Client ID and Secret are from the SAME Self Client as the grant code.');
  console.error('     Regenerating a secret invalidates the old one.');
  console.error('  2. The scopes were entered when generating the code, not left blank.');
  console.error('  3. The client is a "Self Client", not a "Server-based" application.');
  console.error('\nTo confirm your data centre, look at the address bar inside Zoho Books:');
  console.error('  books.zoho.in  -> India      books.zoho.com -> US      books.zoho.eu -> Europe');
  process.exit(1);
}

const { centre, result } = success;

const path = '.env.local';
const existing = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const withoutZoho = existing
  .split(/\r?\n/)
  .filter((line) => !/^\s*ZOHO_/.test(line) && !/^# Zoho Books/.test(line))
  .join('\n');

const block = [
  '',
  '# Zoho Books - server-side only. Never expose these to the browser.',
  `ZOHO_ORG_ID=${ORG_ID}`,
  `ZOHO_CLIENT_ID=${clientId}`,
  `ZOHO_CLIENT_SECRET=${clientSecret}`,
  `ZOHO_REFRESH_TOKEN=${result.refresh_token}`,
  `ZOHO_ACCOUNTS_HOST=${centre.accounts}`,
  `ZOHO_API_HOST=${centre.api}`,
  '',
].join('\n');

fs.writeFileSync(path, `${withoutZoho.trimEnd()}\n${block}`, 'utf8');

console.log(`\nDone. Data centre: ${centre.name}`);
console.log('Refresh token saved to .env.local (git-ignored). It does not expire.');
console.log('\nTell me it worked - do not paste the token here.');
