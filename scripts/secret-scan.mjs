import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
});
const files = output.split('\0').filter(Boolean);
const forbiddenFiles = files.filter((file) => /(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example');
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:PRIVATE_KEY|MNEMONIC|SECRET)\s*[=:]\s*["']?(?:0x)?[a-fA-F0-9]{64}["']?/,
  /(?:MNEMONIC|SEED_PHRASE)\s*[=:]\s*["'][a-z]+(?:\s+[a-z]+){11,23}["']/i,
  /(?:sk_live_|AKIA|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/,
];
const findings = [];

for (const file of files) {
  if (/\.(?:png|jpg|jpeg|gif|webp|pdf|woff2?|ico)$/.test(file)) continue;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (patterns.some((pattern) => pattern.test(content))) findings.push(file);
}

if (forbiddenFiles.length || findings.length) {
  const affected = [...new Set([...forbiddenFiles, ...findings])];
  process.stderr.write(`Potential secret material detected in: ${affected.join(', ')}\n`);
  process.exit(1);
}

process.stdout.write(`Secret scan passed for ${files.length} repository files.\n`);
