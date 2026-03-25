# Agent Working Agreement

## Spec-driven workflow

- Every feature or change must reference a Requirement ID
- Requirements marked Done must have verification evidence
- Do not modify externally visible behavior without updating REQ or ADR

## Definition of Done

- Implementation complete
- Verification added or updated
- TRACE.md updated
- Requirement status updated

## Repository invariants

- Follow existing architecture and conventions
- Avoid unnecessary dependencies or structural changes
- Preserve backwards compatibility unless explicitly required

## Quick Orientation (60 s)

1. `spec/requirements/index.md` — scope and status
2. relevant `spec/requirements/<REQ-ID>.md` — intent + acceptance + pointers
3. active claims in `spec/trace/claims/*`
4. `spec/trace/events/*-<REQ-ID>.md` — implementation history
5. `spec/TRACE.md` — implementation/verification mapping
6. `spec/DECISIONS/README.md` + linked ADRs — constraints
7. `spec/ARCHITECTURE/current-infrastructure.md` — current system context
