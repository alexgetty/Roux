---
title: Beta Release Workflow
tags:
  - roadmap
  - release
  - npm
---
# Beta Release Workflow

## Summary
Add `/release beta` variant that publishes to npm `@beta` dist-tag for early testers.

## Trigger
When Roux has external users who want early access to features before stable release.

## Implementation

### New skill variant
`/release beta` that:
- Allows release from non-main branches (with confirmation)
- Bumps version as prerelease: `0.2.0-beta.1`
- Publishes with `npm publish --tag beta`
- Changelog section marked as prerelease

### npm scripts
```json
"release:beta": "npm version prerelease --preid=beta && npm publish --tag beta && git push && git push --tags"
```

### User installation
```bash
npm install roux@beta
```

### Promotion flow
When beta is stable, promote to latest:
```bash
npm dist-tag add roux@0.2.0-beta.3 latest
```

## Related
- [[Release Skill]] (current main-only implementation)
