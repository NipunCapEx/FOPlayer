# FOPlayer — GitHub Copilot Instructions

These rules apply to human- and AI-assisted work in this repository.

## 1. Product scope and source of truth
- This repository is the source of truth for FOPlayer implementation, tests, CI/CD and public technical documentation.
- `docs/architecture/fno-hedging-dashboard.md` is the approved MVP architecture and acceptance-contract baseline. Update it when approved behaviour, risk formulas, data assumptions, dependencies or release expectations change.
- GitHub issues hold delivery scope, business outcomes, acceptance criteria, dependencies and non-goals. Check existing issues before creating duplicates.
- Do not infer trading policy where the requirements are ambiguous. Document the question and request a decision.
- FOPlayer is a decision-support tool. It does not place trades, guarantee profitability or provide personalized investment advice.

## 2. Before coding
1. Inspect this file, `.ai/repo-profile.md`, the architecture plan, issue, affected code, tests and CI.
2. Identify the business outcome and observable acceptance criteria.
3. Map affected domain, API, persistence, UI, security, notification and operational boundaries.
4. Prefer the smallest coherent change; avoid speculative abstractions and microservices.
5. Preserve provider replaceability and keep risk calculations independent of UI and market-data adapters.
6. Never assume a market-data provider is real-time, complete, reliable or licensed for redistribution without evidence.

## 3. Branch and PR safety
- Never commit directly to `master`.
- Create a focused branch from the latest `master`; deliver all changes through a Pull Request.
- Group related tests and implementation into a meaningful PR; avoid tiny PRs that split one coherent capability.
- A PR must state business value, user-visible behaviour, acceptance criteria, test evidence, CI status, data-source limitations, security impact and documentation impact.
- Do not merge when required checks fail or the PR is not mergeable. Follow repository protection rules; do not bypass them.

## 4. Business-value test contract
Tests must prove outcomes users depend on, not merely execute lines of code.
- Risk thresholds: below 8% no alert; at 8% caution; at 10% critical; at or beyond 12% boundary breach. Test both upside and downside, including exact boundaries and just-below/just-above values.
- For entry ₹1,000, lower/upper structural boundaries are ₹880/₹1,120. Verify displayed movement and risk state against the approved formula.
- Reject zero, negative, NaN, infinite and missing prices/entries; never convert invalid input into a reassuring low-risk state.
- A stale, missing, out-of-order or invalid snapshot must not be represented as current or generate a fresh-price actionable alert.
- Test recovery/re-arm and deduplication semantics before enabling alert delivery; retries must not create duplicate logical alerts.
- Test authentication and authorization at server boundaries, not only in the UI.
- For every workflow, test success, validation errors, dependency failure, partial failure and safe retry where applicable.
- Use deterministic clocks, fixtures and fake provider/notification adapters. Never depend on live market data in required CI tests.
- Include the four supported symbols: RELIANCE, JSWSTEEL, BHARTIARTL and SBICARD.
- State clearly which test layers are intentionally deferred and why.

## 5. Required test layers as the product grows
- Unit: risk formulas, threshold precedence, input validation, volatility assumptions and domain policies.
- API/integration: request validation, authentication/authorization, persistence contracts, provider adapters, and alert idempotency.
- UI/widget: user-visible status, data freshness, loading/error/empty states, strategy configuration and accessible feedback.
- Critical-path E2E: configure a strategy -> receive a validated snapshot -> calculate risk -> record and deliver an alert; include dependency failure and recovery.
- Security: secret scanning, denied unauthorized access, rules/policy checks, and no sensitive credentials in client bundles or logs.

## 6. CI and debugging
- CI is a merge gate, not a replacement for local validation.
- Inspect the actual failing job and logs before changing code. Fix the root cause; never skip, weaken or mask a required test just to turn CI green.
- Do not claim a command or check passed unless it ran and its result was observed.
- Pin dependency versions through committed lockfiles and review dependency changes.
- Run formatting, static analysis, tests with coverage, build, and applicable integration/security checks.
- After merge, verify the default-branch run. Before release, run documented smoke checks and record evidence.
- Keep expensive Android release builds out of routine documentation-only runs; retain an explicit manual release validation path.

## 7. Market-data and financial safety
- Always preserve source, exchange timestamp (when provided), fetch timestamp and validation/freshness state.
- Fail closed when price quality is unknown. Show stale/unavailable status clearly.
- Do not over-scrape, bypass provider limits or redistribute market data without permission. Record provider terms and limitations.
- Keep secrets in approved GitHub/deployment secrets; never place Telegram tokens, Firebase service-account keys or privileged credentials in client code or repository files.
- Treat alerts as informational decision support, not trade instructions or guarantees.

## 8. Documentation and release contract
For every significant change, review whether user behaviour, risk rules, data models, APIs, security, architecture, dependencies, CI or rollout instructions changed. Update the architecture/QA/release docs and issue acceptance criteria as needed. If no docs need changing, say so in the PR.
- Maintain a QA coverage inventory and roadmap/checkpoint based on verified evidence.
- Keep a release runbook covering versioning, configuration, deployment, smoke tests, rollback and known data limitations.
- Never publish credentials, personal data or unsupported claims about data freshness or profitability.

## 9. Definition of done
- [ ] Acceptance criteria and business outcome are met.
- [ ] Unit tests and relevant integration/UI/E2E/security tests added or updated.
- [ ] Boundary, invalid-input, stale-data and failure cases are covered where applicable.
- [ ] Coverage report reviewed; no material uncovered risk path is hidden by aggregate percentages.
- [ ] Formatting, static analysis and build pass locally when tooling is available.
- [ ] Required CI checks pass on the exact PR head.
- [ ] Security, dependencies, secrets and market-data terms reviewed.
- [ ] Docs and QA inventory updated; deliberate omissions recorded.
- [ ] Merge and post-merge verification follow repository rules.

## 10. AI working loop
Inspect -> define business acceptance criteria -> implement -> add meaningful tests -> run local validation -> open/inspect PR -> monitor exact-head CI -> fix root causes -> merge only when allowed and green -> verify post-merge CI -> update QA checkpoint -> continue with the next highest-priority item.
