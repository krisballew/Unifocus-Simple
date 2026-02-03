# Database Schema Reference - Unifocus

## Overview

Multi-tenant PostgreSQL database with 13 models. All tables include `tenantId` for data isolation and cascading delete constraints.

## Models

### Core Organization

#### Tenant

Main organization/company unit

```
id: String (Primary Key)
name: String (required)
email: String (unique, required)
plan: String (default: "free")
status: String (default: "active")
createdAt: DateTime
updatedAt: DateTime

Relations:
- users (one-to-many)
- properties (one-to-many)
- employees (one-to-many)
- schedules (one-to-many)
- shifts (one-to-many)
```

#### User

Users with access to tenants (through UserTenant)

```
id: String (Primary Key)
email: String (unique, required)
firstName: String
lastName: String
password: String (hashed)
status: String (default: "active")
createdAt: DateTime
updatedAt: DateTime

Relations:
- tenants (many-to-many through UserTenant)
- employees (one-to-many)
```

#### UserTenant

Join table for multi-tenant user access

```
userId: String (Foreign Key)
tenantId: String (Foreign Key)
role: String (Admin, Manager, Employee)
status: String (default: "active")
createdAt: DateTime
updatedAt: DateTime

Composite Primary Key: (userId, tenantId)
```

### Property Management

#### Property

Properties/locations managed by tenant

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
name: String (required)
address: String
city: String
state: String
zipCode: String
country: String
timezone: String
type: String (Residential, Commercial, Mixed)
status: String (default: "active")
createdAt: DateTime
updatedAt: DateTime

Relations:
- tenant (many-to-one)
- units (one-to-many)
- employees (one-to-many)
```

#### Unit

Individual units within a property (apartments, offices, etc.)

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
propertyId: String (Foreign Key, required)
number: String (e.g., "101", "A-1")
type: String (Studio, 1BR, 2BR, Office, etc.)
floor: Int
status: String (default: "available")
notes: String
createdAt: DateTime
updatedAt: DateTime

Relations:
- property (many-to-one)
- tenant (many-to-one)
- leases (one-to-many)
```

#### Lease

Tenancy/lease agreements

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
unitId: String (Foreign Key, required)
residentName: String (required)
residentEmail: String
residentPhone: String
startDate: DateTime (required)
endDate: DateTime
rentAmount: Decimal
depositAmount: Decimal
status: String (Active, Expired, Terminated)
notes: String
createdAt: DateTime
updatedAt: DateTime

Relations:
- unit (many-to-one)
- tenant (many-to-one)
```

### Staff Management

#### Employee

Staff members of the organization

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
userId: String (Foreign Key)
firstName: String (required)
lastName: String (required)
email: String (required)
phone: String
position: String (Manager, Supervisor, Cleaner, etc.)
department: String
status: String (default: "active")
hireDate: DateTime
terminationDate: DateTime
propertyId: String (Foreign Key, primary work location)
createdAt: DateTime
updatedAt: DateTime

Relations:
- user (many-to-one)
- tenant (many-to-one)
- property (many-to-one)
- schedule (one-to-one)
- shifts (one-to-many)
- taskAssignments (one-to-many)
```

### Scheduling

#### Schedule

Work schedule templates

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
employeeId: String (Foreign Key, required)
name: String
startDate: DateTime (required)
endDate: DateTime
recurring: Boolean (default: false)
status: String (default: "active")
createdAt: DateTime
updatedAt: DateTime

Relations:
- employee (one-to-one)
- tenant (many-to-one)
- shifts (one-to-many)
```

#### Shift

Individual work shifts

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
scheduleId: String (Foreign Key, required)
employeeId: String (Foreign Key)
date: DateTime (required)
startTime: DateTime (required)
endTime: DateTime (required)
type: String (Regular, Overtime, On-call)
status: String (default: "scheduled")
notes: String
createdAt: DateTime
updatedAt: DateTime

Relations:
- schedule (many-to-one)
- employee (many-to-one)
- tenant (many-to-one)
```

### Task & Work Order Management

#### Task

Maintenance/cleaning tasks

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
title: String (required)
description: String
category: String (Maintenance, Cleaning, Inspection, etc.)
priority: String (Low, Medium, High, Urgent)
status: String (Open, In Progress, Completed, Cancelled)
dueDate: DateTime
createdBy: String
assignedTo: String (Employee ID)
propertyId: String (Foreign Key)
unitId: String (Foreign Key)
completedAt: DateTime
notes: String
createdAt: DateTime
updatedAt: DateTime

Relations:
- tenant (many-to-one)
- property (many-to-one)
- unit (many-to-one)
- taskAssignments (one-to-many)
```

#### TaskAssignment

Assignment of tasks to employees

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
taskId: String (Foreign Key, required)
employeeId: String (Foreign Key, required)
assignedAt: DateTime
completedAt: DateTime
status: String (Assigned, In Progress, Completed)
notes: String
createdAt: DateTime
updatedAt: DateTime

Relations:
- task (many-to-one)
- employee (many-to-one)
- tenant (many-to-one)
```

### Communication & Notifications

#### Notification

System notifications for users

```
id: String (Primary Key)
tenantId: String (Foreign Key, required)
userId: String (Foreign Key, required)
type: String (Task, Schedule, Maintenance, Alert, etc.)
title: String (required)
message: String (required)
read: Boolean (default: false)
readAt: DateTime
actionUrl: String
createdAt: DateTime
updatedAt: DateTime

Relations:
- tenant (many-to-one)
- user (many-to-one)
```

## Data Relationships

```
Tenant (root)
├── Users (via UserTenant join table)
├── Employees
│   ├── Schedule
│   │   └── Shifts
│   └── TaskAssignments
├── Properties
│   ├── Units
│   │   └── Leases
│   └── Tasks
│       └── TaskAssignments
└── Notifications
```

## Constraints & Indexes

### Unique Constraints

- `User.email` - Users can only have one email
- `Tenant.email` - Tenant must have unique email
- `UserTenant` - Composite (userId, tenantId) prevents duplicate memberships
- `Property` - (tenantId, name) prevents duplicate property names per tenant
- `Unit` - (tenantId, propertyId, number) prevents duplicate unit numbers
- `Employee.email` - (tenantId, email) unique per tenant

### Cascading Deletes

When parent is deleted, children are automatically deleted:

- Tenant → Users, Employees, Properties, Schedules, Shifts, Tasks, Notifications
- Property → Units, Tasks
- Unit → Leases
- Schedule → Shifts
- Task → TaskAssignments
- Employee → Shifts, TaskAssignments

### Indexes

Automatically created on:

- All Foreign Keys
- `createdAt`, `updatedAt` timestamps
- Composite unique keys

## Query Patterns

### Get User's Data for a Tenant

```prisma
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    tenants: {
      where: { tenantId: tenantId },
      include: {
        tenant: true
      }
    }
  }
});
```

### Get Tenant Properties with Units

```prisma
const properties = await prisma.property.findMany({
  where: { tenantId: tenantId },
  include: {
    units: true,
    employees: true
  }
});
```

### Get Employee Schedule and Shifts

```prisma
const employee = await prisma.employee.findUnique({
  where: { id: employeeId },
  include: {
    schedule: {
      include: {
        shifts: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    }
  }
});
```

### Get Tenant's Tasks with Assignments

```prisma
const tasks = await prisma.task.findMany({
  where: {
    tenantId: tenantId,
    status: { not: 'Cancelled' }
  },
  include: {
    taskAssignments: {
      include: {
        employee: true
      }
    }
  }
});
```

### Get User's Notifications (Unread)

```prisma
const notifications = await prisma.notification.findMany({
  where: {
    userId: userId,
    read: false
  },
  orderBy: { createdAt: 'desc' },
  take: 20
});
```

## Best Practices

### Always Filter by Tenant

```typescript
// ✓ Correct
const properties = await prisma.property.findMany({
  where: { tenantId: userTenantId },
});

// ✗ Wrong - accessible by all users
const properties = await prisma.property.findMany();
```

### Use Composite Keys for Performance

```typescript
// ✓ More efficient - uses composite key
const user = await prisma.userTenant.findUnique({
  where: {
    userId_tenantId: {
      userId: userId,
      tenantId: tenantId,
    },
  },
});
```

### Eager Load Relations When Needed

```typescript
// ✓ Load all needed data in one query
const property = await prisma.property.findUnique({
  where: { id: propertyId },
  include: {
    units: true,
    employees: true,
    tasks: true,
  },
});

// ✗ Avoid N+1 queries
const property = await prisma.property.findUnique({
  where: { id: propertyId },
});
const units = await prisma.unit.findMany({
  where: { propertyId: propertyId },
});
// ... more queries
```

### Use Pagination for Large Result Sets

```typescript
const page = 1;
const pageSize = 20;

const tasks = await prisma.task.findMany({
  where: { tenantId: tenantId },
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' },
});
```

### Validate Tenant Access Before Querying

```typescript
// Ensure user belongs to requested tenant
const userTenant = await prisma.userTenant.findUnique({
  where: {
    userId_tenantId: {
      userId: userId,
      tenantId: tenantId,
    },
  },
});

if (!userTenant) {
  throw new Error('Access denied to this tenant');
}

// Now safe to query
const properties = await prisma.property.findMany({
  where: { tenantId: tenantId },
});
```

## Migration Commands

```bash
# View schema
pnpm prisma studio

# Create new migration
pnpm prisma migrate dev --name <name>

# Apply pending migrations
pnpm db:migrate

# Seed database with demo data
pnpm db:seed

# Reset database (WARNING: destructive)
pnpm db:reset

# Generate Prisma client
pnpm prisma generate
```

## Data Types

- `String` - Text fields
- `Int` - Integer numbers
- `BigInt` - Large integers
- `Float` - Decimal numbers
- `Decimal` - Fixed-point decimals (for currency)
- `Boolean` - True/false
- `DateTime` - Timestamp with timezone
- `Json` - JSON object (for flexible data)
- `Bytes` - Binary data

## Reserved Fields

Every model includes:

- `createdAt` - Automatically set to current time
- `updatedAt` - Automatically updated on changes
- `tenantId` - For tenant scoping (except User, Notification has it too)
