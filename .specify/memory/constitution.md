<!--
Sync Impact Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Version Change: [TEMPLATE] → 1.1.0
Change Type: MAJOR (Initial constitution establishment)
Date: 2025-11-02

Modified Principles:
  ✓ I. Code Quality — NEW: SOLID principles, type safety, error handling requirements
  ✓ II. Testing Discipline — NEW: TDD mandatory, Red-Green-Refactor, coverage requirements
  ✓ III. User Experience Consistency — NEW: Feedback, accessibility, responsive design
  ✓ IV. Performance Standards — NEW: Response time, bundle size, monitoring requirements
  ✓ V. Documentation Language — NEW: Traditional Chinese (zh-TW) requirement

Added Sections:
  ✓ Technical Standards — Code style, formatting, Python PEP 8, dependency management
  ✓ Development Workflow — Git workflow, code review, CI, feature flags
  ✓ Governance — Amendment process, versioning policy, compliance, enforcement

Templates Requiring Updates:
  ✅ .specify/templates/plan-template.md
     → Constitution Check section exists (line 30-34)
     → Aligned with new principles (quality, testing, UX, performance, documentation)

  ✅ .specify/templates/spec-template.md
     → User scenarios structure supports Testing Discipline principle
     → Requirements section supports Code Quality and Performance principles
     → Language: Should be updated to use Traditional Chinese per Principle V

  ✅ .specify/templates/tasks-template.md
     → Task organization supports TDD workflow (tests before implementation)
     → Phase structure aligns with quality gates
     → Language: Should be updated to use Traditional Chinese per Principle V

Follow-up TODOs:
  ⚠ spec-template.md: Update all placeholder text to Traditional Chinese
  ⚠ tasks-template.md: Update all placeholder text to Traditional Chinese
  ⚠ plan-template.md: Update all placeholder text to Traditional Chinese
  ⚠ Create/update project README.md with Traditional Chinese per Principle V
  ⚠ Review all existing .md files in .specify/ for language compliance

Dependent Artifacts Status:
  ✓ Constitution Check in plan-template.md: Compatible
  ✓ Test-first workflow in tasks-template.md: Compatible
  ⚠ Documentation language: Templates need Traditional Chinese translation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->

# Constitution

## Core Principles

### I. Code Quality

**NON-NEGOTIABLE** — All code MUST meet the following quality standards before merge:

- **Readability First** — Code is written for humans to read and maintain. Clear, self-documenting code with meaningful names takes precedence over clever solutions.
- **SOLID Principles** — Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.
- **DRY with Judgment** — Eliminate repetition where it adds value, but avoid premature abstraction. "Three-strikes" rule: duplicate once, refactor on third occurrence.
- **Type Safety** — Use strong typing wherever available. All public interfaces MUST have explicit type annotations or signatures.
- **Error Handling** — All error paths MUST be explicit. No silent failures; errors MUST carry actionable context.

**Rationale**: Quality debt compounds exponentially. Enforcing standards at creation is 10× cheaper than later remediation.

### II. Testing Discipline

**NON-NEGOTIABLE** — Test-Driven Development (TDD) is MANDATORY for all new features and bug fixes.

**Red-Green-Refactor Cycle**:

- **RED** – Write failing tests first
- **GREEN** – Write minimal code to make tests pass
- **REFACTOR** – Improve code while keeping tests green

**Testing Requirements**:

- **Contract Tests** — REQUIRED for public APIs/libraries/service boundaries
- **Integration Tests** — REQUIRED for cross-component interactions and key user journeys
- **Unit Tests** — REQUIRED for complex business logic and edge cases
- **Coverage** ≥ 80% for new code; 100% for critical paths
- **Independence** — Each test must run individually
- **Performance** — Unit < 100ms, Integration < 5s

**Rationale**: Tests written first define intent and protect refactoring. Tests = living specifications.

### III. User Experience Consistency

**NON-NEGOTIABLE** — All user-facing features must behave consistently.

**UX Principles**:

- **Feedback** — Every action gets immediate visual/text/haptic response
- **Error Messages** — Actionable and non-technical (what happened, why, what to do)
- **Loading States** — Show indicator if operation > 200ms
- **Accessibility** — WCAG 2.1 AA required (keyboard, screen reader, contrast)
- **Responsive Design** — Usable on all target devices and sizes
- **Consistency** — UI patterns and terms must be uniform
- **Progressive Disclosure** — Expose core features first; hide complexity until needed

**Rationale**: Inconsistency erodes trust and increases cognitive load.

### IV. Performance Standards

**NON-NEGOTIABLE** — Performance is a feature, not a phase.

**Requirements**:

- **Response Time** < 100ms (perceived instant)
- **Page Load** < 2s on 3G
- **TTI** (Time to Interactive) < 3s
- **API Latency** p95 < 200ms
- **DB Queries** — No N+1; use indexes
- **Memory** < 200MB (client)
- **Bundle Size** < 500KB gzipped (total), < 100KB critical path

**Monitoring**:

- **Benchmarks** — REQUIRED for critical paths
- **Profiling** before optimizing ("measure, don't guess")
- **Regression Tests** in CI/CD
- **RUM** — Real User Monitoring in production

**Rationale**: Poor performance is a bug affecting all users continuously.

### V. Documentation Language

**NON-NEGOTIABLE** — All project documentation MUST be written in Traditional Chinese (zh-TW).

**Language Requirements**:

- **Specifications** — spec.md files MUST use Traditional Chinese
- **Plans** — plan.md, research.md, data-model.md, etc. MUST use Traditional Chinese
- **Tasks** — tasks.md MUST use Traditional Chinese
- **Analyze Documents** — analyze.md, analysis.md, data-analyze.md and all analysis-related Markdown files MUST use Traditional Chinese
- **User Docs** — README, Quickstart, and API guides MUST use Traditional Chinese
- **Code Comments** — Public API docstrings SHOULD use Traditional Chinese
- **Commit Messages** — MAY use English for global collaboration but Chinese is preferred
- **Constitution Exception** — This file remains in English as the governance reference

**Rationale**: Traditional Chinese is the primary language of stakeholders and users. Native-language docs improve clarity and reduce miscommunication. The English constitution preserves compatibility with international tools.

## Technical Standards

### Code Style & Formatting

- **Linting** — All code MUST pass with zero warnings
- **Formatting** — Automated tools only (Prettier, Black, rustfmt, etc.)
- **Python Coding Style** — All Python code MUST conform to PEP 8
- **Pre-commit Hooks** — REQUIRED for linting, formatting, and local tests
- **Line Length** ≤ 100 characters
- **Comments** — Explain why, not what; code should be self-documenting

### Documentation

- **Public APIs** — REQUIRED comprehensive docs with examples
- **README** — MUST include setup, usage, and contribution guidelines
- **Architecture Decisions** — MUST record major design rationales
- **Inline Docs** — Complex logic requires explanatory comments
- **Changelog** — Semantic versioning required for all releases

### Dependency Management

- **Minimal Dependencies** — Every dependency must be justified; prefer standard library
- **Security** — Scan before adoption and update regularly
- **Versioning** — Pin major/minor; commit lock files
- **License Compatibility** — All dependencies must be license-compatible

## Development Workflow

### Git Workflow

- **Branch naming**: `<type>/<ticket>-<brief>` (e.g., `feature/123-user-auth`)
- **Conventional Commit** messages required
- **Atomic commits** only
- **No direct commits** to main; PRs required
- **Protected branches** require passing CI and reviews

### Code Review

- **≥ 1 approval** from owner; 2 for architectural changes
- **Review scope** includes correctness, tests, docs, performance, security
- **Response time** ≤ 24h
- **Constructive feedback** only — focus on code, not people
- **PRs < 400 lines** preferred; split large ones

### Continuous Integration

- All tests must pass
- Builds must succeed on all targets
- Lint and format checks must pass
- Security scans must pass
- Performance must not regress
- CI duration < 10 minutes

### Feature Flags

- Incomplete features behind flags
- Gradual rollouts recommended
- Kill switch required for critical features
- Remove flags within two sprints after full rollout

## Governance

### Amendment Process

1. **Proposal** — Document change with rationale and impact
2. **Review** — Technical leads assess implications
3. **Approval** — Consensus of maintainers required
4. **Migration** — Provide guides and timelines for compliance
5. **Version Bump** — Increment per semantic versioning

### Versioning Policy

- **MAJOR** — Breaking governance changes
- **MINOR** — New principles or expanded sections
- **PATCH** — Clarifications or non-semantic edits

### Compliance

- **PR Verification** — All PRs must prove compliance
- **Plan Check** — Implementation plans must verify constitution alignment
- **Exceptions** — Document any violations in plan.md with justification
- **Regular Review** — Quarterly review for relevance and effectiveness

### Enforcement

- **Automated** — Use linters, CI checks, and hooks where possible
- **Code Review** — Reviewers must block non-compliant changes
- **Retrospectives** — Track and discuss violations openly
- **Living Document** — The constitution evolves to serve the team

**Version**: 1.1.0 | **Ratified**: 2025-10-18 | **Last Amended**: 2025-11-01
