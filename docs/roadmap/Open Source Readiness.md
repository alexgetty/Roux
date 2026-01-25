# Open Source Readiness

Checklist for preparing Roux for public GitHub release. Run this audit when the codebase is stable enough to invite scrutiny.

## Standard Files

- [ ] **LICENSE** — Choose and add (see [[#Licensing Decision]] below)
- [ ] **README.md** — Audit for first-impression quality
  - [ ] Clear one-liner explaining what Roux is
  - [ ] Why it exists / problem it solves
  - [ ] Installation instructions
  - [ ] Quick usage example
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

### Dependencies
```bash
npm audit
npm outdated
```

- [ ] No high/critical CVEs
- [ ] Dependencies reasonably current
- [ ] Lock file committed

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

- [ ] `.gitignore` comprehensive (node_modules, .env, .DS_Store, IDE configs)
- [ ] No large binary files in history
- [ ] Reasonable commit history (nothing embarrassing in messages)
- [ ] Branch naming sensible (no `alex-wip-trash-v3-final`)

## GitHub Settings (Post-Publish)

- [ ] Description and topics set
- [ ] Website link if applicable
- [ ] Issue templates (bug report, feature request)
- [ ] PR template
- [ ] Branch protection on main
- [ ] Disable unused features (wiki, projects) to reduce surface area

## Optional Polish

- [ ] npm package name available (if publishing to npm)
- [ ] GitHub Actions for CI visible in repo
- [ ] Dependabot or Renovate configured
- [ ] First release tagged with semantic version

---

## Licensing Decision

**Goal:** Protect IP indefinitely while allowing free use for individuals, small companies, non-profits, and self-hosters. Large corporations using commercially should require paid licensing. Prevent competitors from offering Roux as a hosted service.

**Not open source** in the OSI sense—this is **source-available** with commercial protection.

### Option A: Polyform Small Business

Pre-written, lawyer-vetted license. Free for organizations under **$1M revenue / 100 employees**. Larger orgs need commercial terms.

**Pros:**
- Clear, understood thresholds
- No legal fees to draft
- Generous to small players by default

**Cons:**
- Revenue/employee threshold is fixed—may not fit all cases
- Doesn't explicitly address "competing hosted service" scenario

**Reference:** https://polyformproject.org/licenses/small-business/1.0.0

### Option B: Elastic License 2.0 + Commercial Tier

ELv2 as base license (blocks offering as managed/hosted service), with explicit enterprise licensing for large commercial users.

**Pros:**
- Explicitly blocks the "AWS hosts your project" scenario
- Battle-tested (Elasticsearch, Kibana)
- No expiration clause (unlike BSL)
- Can layer custom commercial terms on top

**Cons:**
- Doesn't inherently tier by company size—need separate commercial license doc
- Slightly more complex to explain

**Reference:** https://www.elastic.co/licensing/elastic-license

### Decision Criteria

| Concern | Polyform SB | ELv2 + Commercial |
|---------|-------------|-------------------|
| Blocks hosted competition | Unclear | ✅ Explicit |
| Tiers by org size | ✅ Built-in | Manual |
| No expiration | ✅ | ✅ |
| Simplicity | ✅ | Moderate |
| Legal precedent | Newer | Established |

**Recommendation:** Revisit when ready to publish. If blocking hosted competition is the primary concern, lean ELv2. If tiered access by company size matters more, lean Polyform SB. Could also combine: ELv2 base + "free for small business" addendum.
