# Feature Flags System

## Overview

Property-level feature flags allow enabling/disabling features on a per-property basis within a tenant.

## Database Schema

The `Property` model includes a `features` JSON field that stores feature flag configuration:

```prisma
model Property {
  // ...
  features  Json @default("{}")
  // ...
}
```

## Enabled Feature Flags

All Demo Tenant properties have the following feature flags enabled:

| Flag                      | Description                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- |
| `scheduling_v2`           | Next-generation scheduling with availability, shift swaps, and advanced workflows |
| `time_clock`              | Employee time clock for punching in/out                                           |
| `timecard`                | Timecard management and approval workflows                                        |
| `exceptions_queue`        | Exception tracking and resolution                                                 |
| `hr_management`           | HR management and employee administration                                         |
| `org_structure`           | Organizational structure management (departments, divisions, job roles)           |
| `user_administration`     | User and role management                                                          |
| `properties_management`   | Property configuration and settings                                               |
| `advanced_reporting`      | Advanced analytics and reporting features                                         |
| `mobile_access`           | Mobile app access and features                                                    |
| `labor_compliance`        | Labor law compliance rules and validation                                         |
| `shift_swaps`             | Employee shift swap requests                                                      |
| `availability_management` | Employee availability preferences                                                 |
| `schedule_templates`      | Reusable schedule templates                                                       |
| `auto_scheduling`         | AI-powered automatic schedule generation                                          |

## Usage

### Backend (API)

Check feature flags in your API routes:

```typescript
const property = await prisma.property.findUnique({
  where: { id: propertyId },
  select: { features: true },
});

const features = property.features as Record<string, boolean>;

if (features.scheduling_v2) {
  // Enable Scheduling V2 features
}
```

### Frontend (Web App)

Feature flags can be checked on the property object:

```typescript
const { selectedProperty } = useSelection();

if (selectedProperty?.features?.scheduling_v2) {
  // Show Scheduling V2 UI
}
```

## Setting Feature Flags

### During Seeding

Feature flags are automatically set when creating properties in seed scripts:

```typescript
const allFeatures = {
  scheduling_v2: true,
  time_clock: true,
  // ... other flags
};

await prisma.property.create({
  data: {
    name: 'My Property',
    features: allFeatures,
    // ... other fields
  },
});
```

### Updating Existing Properties

Use the provided utility script:

```bash
cd services/api
pnpm exec tsx prisma/update-features.ts
```

Or update programmatically:

```typescript
await prisma.property.update({
  where: { id: propertyId },
  data: {
    features: {
      scheduling_v2: true,
      time_clock: false,
      // ... other flags
    },
  },
});
```

## Migration

The feature flags system was added via migration `20260207172028_add_property_features`.

All existing properties default to an empty object `{}` (no features enabled). Demo Tenant properties are seeded with all features enabled.
