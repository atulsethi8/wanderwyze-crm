/**
 * Revokes the Zoho refresh token currently in .env.local and clears the Zoho block.
 *
 *   node zoho-revoke.mjs
 *
 * Run this whenever a token may have been exposed. Revocation is immediate and permanent;
 * afterwards, regenerate the client secret in the Zoho API console and re-run zoho-setup.mjs.
 */
import fs from 'node:fs';

const path = '.env.local';
if (!fs.existsSync(path)) {
  console.error('No .env.local found - nothing to revoke.');
  process.exit(1);
}

const raw = fs.readFileSync(path, 'utf8');
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const token = env.ZOHO_REFRESH_TOKEN;
const host = env.ZOHO_ACCOUNTS_HOST || 'https://accounts.zoho.com';

if (!token) {
  console.log('No ZOHO_REFRESH_TOKEN in .env.local - nothing to revoke.');
} else {
  console.log(`Revoking refresh token ending ...${token.slice(-6)} at ${host}`);
  try {
    const response = await fetch(
      `${host}/oauth/v2/token/revoke?token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    const body = await response.text();
    // Zoho answers with JSON on success and an HTML error page on failure.
    if (body.trimStart().startsWith('<')) {
      console.error(`\nZoho returned an error page (HTTP ${response.status}).`);
      console.error('The token may already be invalid, or the data centre host is wrong.');
    } else {
      console.log('Zoho responded:', body.trim().slice(0, 200));
    }
  } catch (error) {
    console.error('Network error while revoking:', error.message);
  }
}

// Strip the Zoho block regardless, so a dead credential is not left lying around.
const cleaned = raw
  .split(/\r?\n/)
  .filter((line) => !/^\s*ZOHO_/.test(line) && !/^# Zoho Books/.test(line))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(path, `${cleaned.trimEnd()}\n`, 'utf8');
console.log('\nZoho entries removed from .env.local.');
console.log('\nNext:');
console.log('  1. Regenerate the client secret at https://api-console.zoho.com (Self Client)');
console.log('  2. Generate a fresh grant code, validity 10 minutes');
console.log('  3. node zoho-setup.mjs');
