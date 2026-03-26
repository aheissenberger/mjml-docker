---
req_id: FR-001
action: override
scope: implementation
owner: copilot-agent
worktree: master
timestamp: 2026-03-26T00:43:00Z
lease_expires_at: null
supersedes_claim: 2026-03-25T23-30-00Z-copilot-agent-claim-FR-001
reason: historical-anomaly-acknowledgement
---

Historical lifecycle anomaly acknowledgement (M1, M2):

M1 — At 2026-03-25T23:31Z a second FR-001 claim was filed while the first claim
(2026-03-25T23:30Z) was still active. The second claim did not set `supersedes_claim`,
omitting the required linkage. Both claims were for the same worktree (master) and the
same owner (copilot-agent); the second claim's independent sub-task (graceful shutdown)
superseded the first (port validation hardening). The first claim should have been
released before the second was filed, or the second claim should have set
`supersedes_claim: 2026-03-25T23-30-00Z-copilot-agent-claim-FR-001`.

M2 — At 2026-03-25T23:50Z a second release of the first FR-001 claim (23:30Z lease)
was filed after that claim was already released at 2026-03-25T23:32Z. The orphaned
release is a no-op and does not alter implementation status. It arose from a batch
release pass that did not check whether the claim was already closed.

No implementation correctness is affected by these anomalies. Both FR-001 sub-tasks
(port validation hardening and graceful shutdown) were completed and verified.
