---
id: 3LUAsAiqrf2h
title: Open Source Readiness
tags:
  - roadmap
type: Feature
status: In Progress
priority: P1
effort: M
phase: Post-MVP
category: Release
---
# Open Source Readiness

Checklist for preparing Roux for public GitHub release. Run this audit when the codebase is stable enough to invite scrutiny.

## Standard Files

- [x] **LICENSE** — MIT. See [[decisions/Licensing]] for rationale.
- [ ] **README.md** — Audit for first-impression quality
  - [x] Clear one-liner explaining what Roux is
  - [x] Why it exists / problem it solves
  - [x] Installation instructions
  - [x] Quick usage example
  - [ ] Screenshot or demo if applicable
  - [ ] Badge row (build status, npm version, license)
- [ ] **CONTRIBUTING.md** — Verify accuracy for external contributors
  - [ ] Setup instructions work on a fresh clone
  - [ ] PR process documented
  - [ ] Code style expectations clear
- [ ] **CODE_OF_CONDUCT.md** — Optional but professional. Contributor Covenant is the standard template
- [ ] **CHANGELOG.md** — Optional but appreciated. Can generate from git tags if using conventional commits

## Security Audit

### Git History
Scan entire history for leaked secrets. These persist even after deletion:

```bash
# Search for common secret patterns
git log -p | grep -iE "(api_key|apikey|secret|password|token|credential)"
git log -p | grep -iE "(sk-|pk_live|AKIA[0-9A-Z]{16})"

# Check for .env files ever committed
git log --all --full-history -- "**/.env*"

# Look for hardcoded paths that reveal system info
git log -p | grep -iE "/Users/|/home/"
```

If secrets found: rewrite history with `git filter-repo` or BFG Repo-Cleaner, then force push. Rotate any exposed credentials.

- [x] History scrubbed (removed .claude/, .obsidian/, and related commit message references)

### Dependencies
```bash
npm audit
npm outdated
```

- [ ] No high/critical CVEs
- [ ] Dependencies reasonably current
- [x] Lock file committed

### Code Review
- [ ] No hardcoded credentials or API keys
- [ ] No internal URLs or private infrastructure references
- [ ] No personal information in comments or test fixtures
- [ ] Error messages don't leak sensitive paths

## Documentation Quality

- [ ] `docs/` content is coherent to outsiders (no assumed internal context)
- [ ] Architecture docs explain the "why" not just "what"
- [ ] No TODO comments referencing private conversations or internal tickets
- [ ] All wikilinks resolve (no broken `[[references]]`)

## Repository Hygiene

- [x] `.gitignore` comprehensive (node_modules, .env, .DS_Store, IDE configs, .claude/, .obsidian/)
- [ ] No large binary files in history
- [x] Reasonable commit history (nothing embarrassing in messages)
- [x] Branch naming sensible

## GitHub Settings (Post-Publish)

- [ ] Description and topics set
- [ ] Website link if applicable
- [ ] Issue templates (bug report, feature request)
- [ ] PR template
- [ ] Branch protection on main
- [ ] Disable unused features (wiki, projects) to reduce surface area

## Optional Polish

- [x] npm package name available — Published as `@gettymade/roux`
- [ ] GitHub Actions for CI visible in repo
- [ ] Dependabot or Renovate configured
- [x] First release tagged with semantic version (v0.1.0)

---

## Licensing Decision

**Decision:** MIT License for initial release. See [[decisions/Licensing]] for full rationale.

**Summary:** Prioritizing simplicity and adoption over protection. Can switch to Polyform Small Business on future versions if commercial interest emerges. MIT on v0.1.x doesn't lock future versions.
