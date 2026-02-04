# Next Vertical Slice: Scheduling

This plan describes the next vertical slice of the scheduling domain, grounded in the current Fastify + Prisma backend and Vite/React frontend. It focuses on four deliverables:

1. Schedule create/edit
2. Publish workflow
3. Open shifts + pickup rules v1
4. Notifications (email/push placeholder via event queue)

---

## Goals

- Enable managers to create and edit schedules and shifts.
- Provide a publish action that locks a schedule version and notifies staff.
- Allow open shift creation and employee pickup requests with v1 rules.
- Emit notification events to an internal queue for future email/push delivery.

---

## Current Baseline (Relevant Modules)

Backend:

- [services/api/src/routes/ta.ts](../services/api/src/routes/ta.ts) (schedules, shifts, punches, exceptions)
- [services/api/src/services/audit-logger.ts](../services/api/src/services/audit-logger.ts) (audit logging)
- [services/api/src/services/idempotency.ts](../services/api/src/services/idempotency.ts) (idempotency)
- [services/api/prisma/schema.prisma](../services/api/prisma/schema.prisma) (Schedule, Shift, Employee, AuditLog)

Frontend:

- [apps/web/src/pages](../apps/web/src/pages) (route-level pages)
- [apps/web/src/components](../apps/web/src/components) (shared components)
- [apps/web/src/services/api-client.ts](../apps/web/src/services/api-client.ts) (API client)

Testing:

- [services/api/tests](../services/api/tests) (Tap-based tests)

---

## Implementation Plan (Concrete)

### 1. Schedule Create/Edit

#### API Routes (Fastify)

Add/extend endpoints in [services/api/src/routes/ta.ts](../services/api/src/routes/ta.ts):

- POST /api/schedules
  - Already exists for create; extend to accept schedule metadata (name, date range, status draft).
  - Add idempotency support with Idempotency-Key.
  - AuditLogger action: created.

- PUT /api/schedules/:scheduleId
  - New endpoint to edit schedule name/date range.
  - Validate tenant scope and ownership.
  - AuditLogger action: updated with before/after changes.

- GET /api/schedules/:scheduleId
  - New endpoint for schedule detail view.

- PUT /api/shifts/:shiftId
  - New endpoint to edit shift times, break minutes, assigned employee.
  - Validate tenant scope and schedule status (cannot edit published schedules unless a new draft is created).

#### DB Schema Changes (Prisma)

Modify [services/api/prisma/schema.prisma](../services/api/prisma/schema.prisma):

- Schedule
  - Add status enum: draft | published | archived
  - Add publishedAt timestamp
  - Add version number (increment on publish)

- Shift
  - Add status enum: draft | published | open
  - Add publishedAt timestamp

#### UI (React)

Add pages and components:

- New page: [apps/web/src/pages/SchedulingPage.tsx](../apps/web/src/pages/SchedulingPage.tsx)
  - Schedule list + create button.

- New page: [apps/web/src/pages/ScheduleEditorPage.tsx](../apps/web/src/pages/ScheduleEditorPage.tsx)
  - Edit schedule metadata and shifts.

- New components:
  - [apps/web/src/components/ScheduleForm.tsx](../apps/web/src/components/ScheduleForm.tsx)
  - [apps/web/src/components/ShiftEditor.tsx](../apps/web/src/components/ShiftEditor.tsx)
  - [apps/web/src/components/ScheduleHeader.tsx](../apps/web/src/components/ScheduleHeader.tsx)

#### Tests

- Add tests: [services/api/tests/schedules.test.ts](../services/api/tests/schedules.test.ts)
  - Create schedule (tenant scoped).
  - Update schedule (audit log created).
  - Edit shift (invalid if schedule published).

---

### 2. Publish Workflow

#### API Routes

Add in [services/api/src/routes/ta.ts](../services/api/src/routes/ta.ts):

- POST /api/schedules/:scheduleId/publish
  - Validates schedule in draft state.
  - Sets schedule.status = published, sets publishedAt, increments version.
  - Updates shifts to published status.
  - Emits notification events for affected employees.
  - AuditLogger action: updated (schedule) + created (notification events).

- POST /api/schedules/:scheduleId/unpublish
  - Optional: revert schedule to draft for corrections.
  - Enforced by role (Manager/Admin).

#### DB Schema Changes

- Schedule status and version fields (from section 1).
- Add index: (tenantId, status, startDate, endDate) for list queries.

#### UI

- Add publish button in [apps/web/src/components/ScheduleHeader.tsx](../apps/web/src/components/ScheduleHeader.tsx).
- Add confirmation modal in [apps/web/src/components/PublishConfirmModal.tsx](../apps/web/src/components/PublishConfirmModal.tsx).

#### Tests

- Extend [services/api/tests/schedules.test.ts](../services/api/tests/schedules.test.ts):
  - Publish transitions draft → published.
  - Shifts updated to published.
  - Audit log entry created.

---

### 3. Open Shifts + Pickup Rules v1

#### DB Schema Changes

Modify [services/api/prisma/schema.prisma](../services/api/prisma/schema.prisma):

- New model: OpenShift
  - id, tenantId, scheduleId, shiftId
  - status: open | claimed | cancelled
  - createdAt, updatedAt

- New model: ShiftPickupRule
  - id, tenantId, propertyId
  - maxHoursPerWeek
  - minHoursBetweenShifts
  - requireManagerApproval boolean
  - createdAt, updatedAt

- Shift
  - Add openShiftId nullable (relation)

#### API Routes

Add in [services/api/src/routes/ta.ts](../services/api/src/routes/ta.ts):

- POST /api/open-shifts
  - Creates an open shift from an existing shift.
  - Validates schedule published.
  - AuditLogger action: created.

- GET /api/open-shifts
  - Lists open shifts (tenant scoped, filter by property/department).

- POST /api/open-shifts/:openShiftId/claim
  - Employee claims open shift.
  - Applies pickup rules (v1).
  - AuditLogger action: updated.

- POST /api/pickup-rules
  - Creates or updates property-level pickup rules.

#### Services

Add new services:

- [services/api/src/services/pickup-rules.ts](../services/api/src/services/pickup-rules.ts)
  - Validate pickup against max hours and rest window.

- [services/api/src/services/open-shifts.ts](../services/api/src/services/open-shifts.ts)
  - Encapsulate open shift creation and claim logic.

#### UI

- New page: [apps/web/src/pages/OpenShiftsPage.tsx](../apps/web/src/pages/OpenShiftsPage.tsx)
- New component: [apps/web/src/components/OpenShiftList.tsx](../apps/web/src/components/OpenShiftList.tsx)
- New component: [apps/web/src/components/OpenShiftCard.tsx](../apps/web/src/components/OpenShiftCard.tsx)

#### Tests

- Add tests: [services/api/tests/open-shifts.test.ts](../services/api/tests/open-shifts.test.ts)
  - Create open shift (only from published schedule).
  - Claim open shift (rule enforcement).
  - Prevent double-claim.

---

### 4. Notifications (Email/Push Placeholder via Event Queue)

#### DB Schema Changes

Add a lightweight event queue to [services/api/prisma/schema.prisma](../services/api/prisma/schema.prisma):

- New model: NotificationEvent
  - id, tenantId
  - type: schedule_published | shift_opened | shift_claimed
  - payload (JSON)
  - status: pending | sent | failed
  - createdAt, updatedAt

#### Services

Add event queue service:

- [services/api/src/services/event-queue.ts](../services/api/src/services/event-queue.ts)
  - enqueue(type, payload)
  - markSent(eventId)
  - markFailed(eventId, reason)

- [services/api/src/services/notification-service.ts](../services/api/src/services/notification-service.ts)
  - translate domain actions into NotificationEvent entries

#### API Integration

- Schedule publish endpoint should enqueue events for each employee in the schedule.
- Open shift creation should enqueue event for eligible employees.
- Open shift claim should enqueue event for manager approval (if required).

#### UI (Placeholder)

- Add in-app notification placeholder (optional):
  - [apps/web/src/components/NotificationBanner.tsx](../apps/web/src/components/NotificationBanner.tsx)

#### Tests

- Add tests: [services/api/tests/notifications.test.ts](../services/api/tests/notifications.test.ts)
  - Enqueue on publish.
  - Enqueue on open shift creation.
  - Event status transitions: pending → sent/failed.

---

## API Contract Summary

| Route                        | Method | Purpose                      |
| ---------------------------- | ------ | ---------------------------- |
| /api/schedules               | POST   | Create schedule (idempotent) |
| /api/schedules/:id           | PUT    | Edit schedule metadata       |
| /api/schedules/:id           | GET    | Schedule details             |
| /api/schedules/:id/publish   | POST   | Publish schedule             |
| /api/schedules/:id/unpublish | POST   | Revert publish               |
| /api/shifts/:id              | PUT    | Edit shift                   |
| /api/open-shifts             | POST   | Create open shift            |
| /api/open-shifts             | GET    | List open shifts             |
| /api/open-shifts/:id/claim   | POST   | Claim open shift             |
| /api/pickup-rules            | POST   | Create/update pickup rules   |

---

## Tests Required (Minimum)

Backend (Tap):

- [services/api/tests/schedules.test.ts](../services/api/tests/schedules.test.ts)
- [services/api/tests/open-shifts.test.ts](../services/api/tests/open-shifts.test.ts)
- [services/api/tests/notifications.test.ts](../services/api/tests/notifications.test.ts)

Frontend (optional for this slice):

- Add component tests using Vitest + React Testing Library if desired.

---

## Rollout Steps

1. Add Prisma models and run migration.
2. Implement API endpoints + services.
3. Add UI pages/components and wire routes.
4. Add tests and ensure CI passes.
5. Seed sample schedules and open shifts for dev.
6. Validate end-to-end using [scripts/e2e-dev-smoke.ts](../scripts/e2e-dev-smoke.ts) (extend for scheduling flows).

---

## Definition of Done

- Schedule create/edit + publish flows implemented.
- Open shifts + pickup rules v1 implemented.
- Notification events created for publish and open shift actions.
- All endpoints tenant-scoped and idempotent.
- Audit logs created for every write action.
- Tests added and passing.
