const REDACTION_PLACEHOLDER = '<REDACTED>';
const SECRET_FILE_PATTERNS = [/^\.env(?:\.[A-Za-z0-9_.-]+)?$/i];
const SAFE_ENV_FILE_EXCEPTIONS = new Set(['.env.example', '.env.sample', '.env.template', '.env.defaults', '.env.dist']);

function safeBasename(filePath) {
  return String(filePath || '.env').split(/[\\/]/).pop() || '.env';
}

function parseEnvText(text, filePath = '.env') {
  const lines = String(text ?? '').split(/\r?\n/);
  const entries = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    let working = trimmed;
    if (working.startsWith('export ')) {
      working = working.slice('export '.length).trim();
    }

    const match = working.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue;
    let quoted = false;

    if (rawValue.length >= 2) {
      if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        value = rawValue.slice(1, -1);
        quoted = true;
      }
    }

    entries.push({
      key,
      value,
      raw: rawLine,
      filePath,
      lineNumber: i + 1,
      quoted,
      empty: value === '',
    });
  }

  return entries;
}

function isSensitiveValue(value, key) {
  if (value === undefined || value === null) return true;

  const stringValue = String(value).trim();
  if (stringValue === '') return false;

  const normalizedKey = String(key || '').toUpperCase();
  const hasSecretKeyPattern = /(SECRET|TOKEN|PASSWORD|SESSION|JWT|STRIPE|API[_-]?KEY|CLIENT[_-]?SECRET|ACCESS[_-]?KEY|REFRESH[_-]?TOKEN|PRIVATE|CREDENTIAL|AUTH|SMTP|DATABASE|DATABASE_URL)/i.test(normalizedKey);

  if (hasSecretKeyPattern) {
    return true;
  }

  const looksLikeUrl = /^(?:[a-z]+:)?\/\//i.test(stringValue) || /^(?:postgres(?:ql)?|mysql|mongodb|redis|amqp|http|https):\/\//i.test(stringValue);
  const looksLikeCredential = /(?:^|[\s:=])(?:[A-Za-z0-9_+\-]{8,}):[A-Za-z0-9._~!$&'()*+,;=:@%\-]+@/i.test(stringValue);
  const looksLikeToken = /^(?:sk|pk|ghp|gho|gsk|ghu|xox[baprs]-|AIza|hf_[A-Za-z0-9_\-]+|eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)$/i.test(stringValue);

  return looksLikeUrl || looksLikeCredential || looksLikeToken || stringValue.length >= 12;
}

function buildSafeEnvRepresentation(text, filePath = '.env') {
  const path = String(filePath || '.env');
  const baseName = safeBasename(path);
  const isTemplateFile = SAFE_ENV_FILE_EXCEPTIONS.has(baseName);
  if (isTemplateFile) {
    return String(text ?? '');
  }

  const lines = String(text ?? '').split(/\r?\n/);
  const output = [];
  const seenKeys = new Set();

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      output.push(line);
      continue;
    }

    const working = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const match = working.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const [, key, rawValue] = match;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    let value = rawValue;
    if (rawValue.length >= 2) {
      if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        value = rawValue.slice(1, -1);
      }
    }

    if (isSensitiveValue(value, key)) {
      output.push(`${key}=${REDACTION_PLACEHOLDER}`);
    } else {
      output.push(`${key}=${value}`);
    }
  }

  return output.join('\n') + (output.length > 0 && lines.at(-1) !== '' ? '\n' : '');
}

function redactKnownSecrets(text, secretValues = []) {
  if (!text || !Array.isArray(secretValues) || secretValues.length === 0) {
    return String(text ?? '');
  }

  let redacted = String(text ?? '');
  const values = [...new Set(secretValues.filter((value) => typeof value === 'string' && value.length >= 1))];

  for (const value of values) {
    const normalized = String(value).trim();
    if (!normalized) continue;

    const urlCredentialPattern = /((?:[a-z][a-z0-9+\-.]*):\/\/)([^:/@\s]+):([^@/\s]+)(@[^/\s]+)/gi;
    redacted = redacted.replace(urlCredentialPattern, '$1$2:<REDACTED>$4');

    if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(normalized) || !normalized.includes('@')) {
      redacted = redacted.replace(new RegExp(`(${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), REDACTION_PLACEHOLDER);
    }
  }

  const tokenPattern = /(Authorization:\s*Bearer\s+)([A-Za-z0-9._~+\-=/]+)/gi;
  redacted = redacted.replace(tokenPattern, '$1<REDACTED>');

  return redacted;
}

function createEnvRedactionManager() {
  const registry = new Map();

  function registerFromText(text, filePath = '.env') {
    const entries = parseEnvText(text, filePath);
    for (const entry of entries) {
      if (entry.value !== '' && isSensitiveValue(entry.value, entry.key)) {
        registry.set(entry.key, entry.value);
      }
    }
    return registry;
  }

  function getSecretValues() {
    return Array.from(registry.values());
  }

  function getSafeRepresentation(text, filePath = '.env') {
    return buildSafeEnvRepresentation(text, filePath);
  }

  return {
    registerFromText,
    getSecretValues,
    getSafeRepresentation,
    registry,
  };
}

export {
  REDACTION_PLACEHOLDER,
  SECRET_FILE_PATTERNS,
  SAFE_ENV_FILE_EXCEPTIONS,
  parseEnvText,
  isSensitiveValue,
  buildSafeEnvRepresentation,
  redactKnownSecrets,
  createEnvRedactionManager,
};