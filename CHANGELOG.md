# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Author:** Waxbix (contact@waxbix.com)  
**Website:** https://waxbix.com  
**Repository:** https://github.com/GetWibix/opencode-env-redaction

## [Unreleased]

### Added
- Initial release of opencode-env-redaction plugin
- Automatic secret detection and redaction for 15+ providers
- Session hooks for prompt, context, compaction, generate, and title
- Context-aware detection (requires secret-suggesting key name + known pattern)
- Zero-config installation

### Supported Secret Patterns
- AWS Access Keys (AKIA...)
- GitHub Tokens (ghp_, github_pat_)
- OpenAI API Keys (sk-, sk-proj-)
- Stripe Keys (sk_live_, rk_live_)
- Google API Keys (AIza...)
- Slack Tokens (xoxb-, xoxp-, etc.)
- JWT Tokens (eyJ...)
- Generic Base64 (32+ chars)
- Generic Hex (32+ chars)

## [1.0.0] - 2026-11-13

### Added
- First stable release
- MIT License
- Comprehensive README with installation and usage guide
- CONTRIBUTING.md for community contributions
- GitHub-ready package structure

---

## Versioning

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions publishes to npm (when configured)