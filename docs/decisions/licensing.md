---
title: Licensing
tags:
  - decision
  - licensing
---
# Decision - Licensing

**Status:** Decided
**Date:** 2026-01-26
**Affects:** Distribution, commercial use, open source strategy

## Context

Roux needed a license before publishing to npm. The goal was to balance:
- Simplicity (ship fast, minimal friction)
- Protection (prevent large companies from profiting without contribution)
- Pragmatism (this is primarily a personal tool)

## Options Considered

### MIT License
Maximally permissive. Anyone can use, modify, distribute, sell, sublicense. No restrictions.

**Pros:**
- Simple, universally understood
- Maximum adoption potential
- No friction for contributors
- Can change license on future versions

**Cons:**
- No protection against commercial exploitation
- Large companies can use freely without paying

### Polyform Small Business
Source-available. Free for organizations under $1M revenue / 100 employees. Larger orgs need commercial terms.

**Pros:**
- Protects against large commercial users
- Still free for individuals, small companies, non-profits
- Lawyer-vetted, plain language

**Cons:**
- Less familiar to developers
- May discourage some contributions
- Doesn't explicitly block hosted-service competition

### Elastic License 2.0 (ELv2)
Source-available. Explicitly blocks offering software as a hosted/managed service.

**Pros:**
- Blocks "AWS hosts your project" scenario
- Battle-tested (Elasticsearch)

**Cons:**
- Doesn't tier by company size
- More complex to explain

## Decision

**MIT License** for initial release.

## Rationale

1. **Pragmatism over protection** — Roux is primarily a personal tool. The realistic chance of commercial exploitation is low.

2. **Simplicity** — MIT is universally understood. Zero friction for anyone who wants to use or contribute.

3. **Reversibility** — MIT on v0.1.x doesn't lock future versions. If Roux gains traction and commercial interest emerges, future versions can adopt Polyform or similar.

4. **Adoption over monetization** — At this stage, getting users and feedback matters more than protecting hypothetical revenue.

## Future Considerations

If any of these occur, revisit licensing:
- Significant commercial adoption by large companies
- Competitor forks gaining traction
- Revenue opportunity becomes concrete

Switching to Polyform Small Business on a future major version would be straightforward. Users of MIT-licensed versions keep those rights; new features would require the new license.

## Related

- [[Open Source Readiness]] — Pre-publish checklist
- [[Decisions]] — Decision index
