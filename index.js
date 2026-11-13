import { Plugin } from "@opencode/plugin";
import { createEnvRedactionManager, isSensitiveValue, redactKnownSecrets } from "./src/env-redactor.js";

const manager = createEnvRedactionManager();

// قائمة الأنماط المعروفة للرموز الحساسة (API keys, tokens, etc.)
const SECRET_PATTERNS = [
  // AWS keys
  /AKIA[0-9A-Z]{16}/,
  // GitHub tokens
  /gh[ps]_[0-9a-zA-Z]{36}/,
  /github_pat_[0-9a-zA-Z]{22}_[0-9a-zA-Z]{59}/,
  // OpenAI keys
  /sk-[a-zA-Z0-9]{48}/,
  /sk-proj-[a-zA-Z0-9]{48}/,
  // Stripe keys
  /sk_live_[0-9a-zA-Z]{24}/,
  /rk_live_[0-9a-zA-Z]{24}/,
  // Google API keys
  /AIza[0-9A-Za-z\-_]{35}/,
  // Slack tokens
  /xox[baprs]-[0-9a-zA-Z-]{10,}/,
  // Generic JWT
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  // Generic base64-like secrets (32+ chars)
  /[A-Za-z0-9+/]{32,}={0,2}/,
  // Hex secrets (32+ chars)
  /[0-9a-f]{32,}/i,
];

function isKnownSecretPattern(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  // Must be at least 20 chars to be a secret
  if (trimmed.length < 20) return false;
  
  // Check against known patterns
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function sanitizeString(value) {
  if (typeof value !== "string") {
    return value;
  }

  // First, redact known secrets from .env files
  const knownSecrets = manager.getSecretValues();
  let result = value;
  if (knownSecrets.length > 0) {
    result = redactKnownSecrets(result, knownSecrets);
  }

  // Also detect and redact sensitive patterns on-the-fly
  // Only for key=value patterns where value matches known secret patterns
  const lines = result.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for key=value patterns where value looks like a secret
    const keyValueMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (keyValueMatch) {
      const [, key, val] = keyValueMatch;
      let cleanedVal = val.trim();
      // Remove quotes
      if (
        (cleanedVal.startsWith('"') && cleanedVal.endsWith('"')) ||
        (cleanedVal.startsWith("'") && cleanedVal.endsWith("'"))
      ) {
        cleanedVal = cleanedVal.slice(1, -1);
      }
      // Check if key name suggests secret AND value matches secret pattern
      const keySuggestsSecret = /(SECRET|TOKEN|PASSWORD|SESSION|JWT|STRIPE|API[_-]?KEY|CLIENT[_-]?SECRET|ACCESS[_-]?KEY|REFRESH[_-]?TOKEN|PRIVATE|CREDENTIAL|AUTH|SMTP|DATABASE|DATABASE_URL)/i.test(key);
      if (keySuggestsSecret && (isSensitiveValue(cleanedVal, key) || isKnownSecretPattern(cleanedVal))) {
        lines[i] = `${key}=<REDACTED>`;
      }
    }
    // Do NOT redact bare lines - too aggressive
  }
  result = lines.join("\n");

  return result;
}

function sanitizeObject(value) {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeObject(item));
  if (typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = sanitizeObject(child);
    }
    return result;
  }
  return value;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  for (const message of messages) {
    if (!message || !message.parts) continue;
    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];
      if (typeof part === "string") {
        message.parts[i] = sanitizeString(part);
      } else if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        part.text = sanitizeString(part.text);
      }
    }
  }
  return messages;
}

export default Plugin.define({
  id: "env-redaction",
  async setup(ctx) {
    console.log("[env-redaction] Plugin loaded!");

    // Hook 1: Sanitize user prompts - only if they contain actual secret patterns
    await ctx.session.hook("prompt", (event) => {
      if (event.prompt.text) {
        // Only sanitize if the prompt contains actual secret patterns
        const text = event.prompt.text;
        // If it's a simple command like echo/export, don't sanitize the prompt
        // The tool output will be sanitized by the context hook
        const isSimpleCommand = /^(echo|export)\s+/.test(text.trim());
        if (!isSimpleCommand && isKnownSecretPattern(text)) {
          event.prompt.text = sanitizeString(text);
        }
      }
      // Also sanitize files if they contain sensitive data
      if (event.prompt.files) {
        for (const file of event.prompt.files) {
          if (file.content && typeof file.content === "string") {
            file.content = sanitizeString(file.content);
          }
        }
      }
    });

    // Hook 2: Sanitize context/messages before model calls
    // This catches tool output, file contents, etc. that go to the model
    await ctx.session.hook("context", (event) => {
      // Sanitize system messages
      if (event.system) {
        for (const sysMsg of event.system) {
          if (sysMsg.text) {
            sysMsg.text = sanitizeString(sysMsg.text);
          }
        }
      }
      // Sanitize user/assistant messages (tool outputs, file reads, etc.)
      sanitizeMessages(event.messages);
      // Sanitize tools if they contain sensitive info in descriptions
      if (event.tools) {
        for (const tool of Object.values(event.tools)) {
          if (tool.description) {
            tool.description = sanitizeString(tool.description);
          }
        }
      }
    });

    // Hook 3: Sanitize compaction summaries
    await ctx.session.hook("compaction", (event) => {
      sanitizeMessages(event.messages);
    });

    // Hook 4: Sanitize generate calls
    await ctx.session.hook("generate", (event) => {
      if (event.prompt) {
        event.prompt = sanitizeString(event.prompt);
      }
      sanitizeMessages(event.messages);
    });

    // Hook 5: Sanitize title generation
    await ctx.session.hook("title", (event) => {
      sanitizeMessages(event.messages);
    });

    return () => {
      console.log("[env-redaction] Plugin unloaded");
    };
  },
});