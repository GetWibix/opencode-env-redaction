# Contributing to opencode-env-redaction

Thank you for your interest in contributing! This document outlines the process for contributing to this OpenCode plugin.

## 🎯 Ways to Contribute

- **Report bugs** — Found a false positive/negative? [Open an issue](https://github.com/GetWibix/opencode-env-redaction/issues)
- **Suggest features** — Have an idea for improvement? [Start a discussion](https://github.com/GetWibix/opencode-env-redaction/discussions)
- **Add secret patterns** — Know a new API key format? Add it!
- **Improve documentation** — Fix typos, add examples, translate
- **Code contributions** — Bug fixes, performance improvements, new hooks

## 🚀 Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/GetWibix/opencode-env-redaction.git
   cd opencode-env-redaction
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🧪 Testing Your Changes

### Manual Testing
```bash
# Link your local version for testing
npm link
opencode plugin add file:$(pwd)

# Test with a file containing secrets
echo 'API_KEY=sk-test-1234567890' > test.env
opencode run "read test.env"
# Verify output shows: API_KEY=<REDACTED>

# Test normal text (should NOT be redacted)
echo 'NORMAL_VAR=hello world' > test.txt
opencode run "read test.txt"
# Verify output shows: NORMAL_VAR=hello world
```

### Test Cases to Verify
- [ ] Known secret patterns are redacted (AWS, GitHub, OpenAI, Stripe, etc.)
- [ ] Normal key=value pairs are NOT redacted
- [ ] Short strings (< 20 chars) are NOT redacted
- [ ] Bare tokens without key context are NOT redacted (prevents false positives)
- [ ] File contents with mixed secrets and normal text work correctly

## 📝 Adding New Secret Patterns

To add support for a new provider's secret format:

1. Open `src/env-redactor.js`
2. Add the regex pattern to `SECRET_PATTERNS` array:
   ```javascript
   const SECRET_PATTERNS = [
     // ... existing patterns
     /NEW_PROVIDER_[A-Z0-9]{20,}/,  // Your new pattern
   ];
   ```
3. Test with a sample secret from that provider
4. Add documentation in README.md under "Supported Secret Patterns"

## 🎨 Code Style

- **ES Modules** — Use `import`/`export`
- **Async/Await** — Prefer over callbacks
- **JSDoc** — Document public functions
- **No linting configured yet** — Follow existing style

## 📦 Pull Request Process

1. **Update CHANGELOG.md** with your changes
2. **Run tests** manually (see above)
3. **Update documentation** if needed
4. **Submit PR** with:
   - Clear title and description
   - Reference any related issues
   - Screenshots/logs for visual changes

### PR Title Format
```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scopes: patterns, hooks, core, docs, deps
```

Examples:
- `feat(patterns): add support for Vercel API tokens`
- `fix(core): prevent false positive on short hex strings`
- `docs(readme): add installation via OpenCode CLI`

## 🐛 Reporting Bugs

When reporting a bug, please include:

1. **OpenCode version**: `opencode --version`
2. **Plugin version**: Check `package.json`
3. **Steps to reproduce**
4. **Expected vs actual behavior**
5. **Sample input** (sanitized!)
6. **Logs** (run with `--print-logs`)

## 💡 Feature Requests

For new features, please:
1. Check existing issues/discussions first
2. Open a discussion to gather feedback
3. Describe the use case and proposed solution
4. Consider implementation complexity

## 📋 Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this code.

## 📞 Questions?

- Open a [GitHub Discussion](https://github.com/GetWibix/opencode-env-redaction/discussions)
- Join [OpenCode Discord](https://discord.gg/opencode)
- Email: [contact@waxbix.com](mailto:contact@waxbix.com)

---

**Thank you for contributing!** 🎉