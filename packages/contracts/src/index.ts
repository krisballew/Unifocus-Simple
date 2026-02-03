import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const TimestampSchema = z.string().datetime();
export const URLSchema = z.string().url();

// ============================================================================
// Tenant
// ============================================================================

export const TenantSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  domain: z.string().optional(),
  status: z.enum(['active', 'suspended', 'inactive']),
  settings: z.record(z.unknown()).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Tenant = z.infer<typeof TenantSchema>;

export const CreateTenantSchema = TenantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateTenant = z.infer<typeof CreateTenantSchema>;

// ============================================================================
// Property
// ============================================================================

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string().default('US'),
});

export type Address = z.infer<typeof AddressSchema>;

export const PropertySchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  address: AddressSchema,
  timezone: z.string().default('America/New_York'),
  status: z.enum(['active', 'inactive', 'maintenance']),
  settings: z.record(z.unknown()).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Property = z.infer<typeof PropertySchema>;

export const CreatePropertySchema = PropertySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProperty = z.infer<typeof CreatePropertySchema>;

// ============================================================================
// Department
// ============================================================================

export const DepartmentSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  parentId: UUIDSchema.optional(),
  isActive: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Department = z.infer<typeof DepartmentSchema>;

export const CreateDepartmentSchema = DepartmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateDepartment = z.infer<typeof CreateDepartmentSchema>;

// ============================================================================
// Role
// ============================================================================

export const PermissionSchema = z.enum([
  'read',
  'write',
  'delete',
  'manage_users',
  'manage_roles',
  'manage_schedules',
  'manage_timekeeping',
  'manage_compliance',
  'view_reports',
  'admin',
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(PermissionSchema),
  isSystem: z.boolean().default(false),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleSchema = RoleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateRole = z.infer<typeof CreateRoleSchema>;

// ============================================================================
// User
// ============================================================================

export const UserSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  email: EmailSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phoneNumber: z.string().optional(),
  roleId: UUIDSchema,
  isActive: z.boolean().default(true),
  lastLoginAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

// ============================================================================
// Employee
// ============================================================================

export const EmployeeStatusSchema = z.enum(['active', 'inactive', 'on_leave', 'terminated']);

export const EmploymentTypeSchema = z.enum(['full_time', 'part_time', 'contract', 'temporary']);

export const EmployeeSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  departmentId: UUIDSchema,
  userId: UUIDSchema.optional(),
  employeeNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: EmailSchema.optional(),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  hireDate: z.string(),
  terminationDate: z.string().optional(),
  status: EmployeeStatusSchema,
  employmentType: EmploymentTypeSchema,
  payRate: z.number().positive().optional(),
  payType: z.enum(['hourly', 'salary']).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Employee = z.infer<typeof EmployeeSchema>;

export const CreateEmployeeSchema = EmployeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;

// ============================================================================
// Job
// ============================================================================

export const JobSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  departmentId: UUIDSchema,
  title: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  payRateMin: z.number().positive().optional(),
  payRateMax: z.number().positive().optional(),
  isActive: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Job = z.infer<typeof JobSchema>;

export const CreateJobSchema = JobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateJob = z.infer<typeof CreateJobSchema>;

// ============================================================================
// Shift
// ============================================================================

export const ShiftStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);

export const ShiftSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  departmentId: UUIDSchema,
  jobId: UUIDSchema,
  employeeId: UUIDSchema.optional(),
  scheduledStart: TimestampSchema,
  scheduledEnd: TimestampSchema,
  actualStart: TimestampSchema.optional(),
  actualEnd: TimestampSchema.optional(),
  breakMinutes: z.number().int().min(0).default(0),
  status: ShiftStatusSchema,
  notes: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Shift = z.infer<typeof ShiftSchema>;

export const CreateShiftSchema = ShiftSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateShift = z.infer<typeof CreateShiftSchema>;

// ============================================================================
// Punch
// ============================================================================

export const PunchTypeSchema = z.enum(['in', 'out', 'break_start', 'break_end']);

export const PunchSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  employeeId: UUIDSchema,
  shiftId: UUIDSchema.optional(),
  punchTime: TimestampSchema,
  punchType: PunchTypeSchema,
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  deviceId: z.string().optional(),
  notes: z.string().optional(),
  isManual: z.boolean().default(false),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Punch = z.infer<typeof PunchSchema>;

export const CreatePunchSchema = PunchSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreatePunch = z.infer<typeof CreatePunchSchema>;

// ============================================================================
// Exception
// ============================================================================

export const ExceptionTypeSchema = z.enum([
  'late_arrival',
  'early_departure',
  'missed_punch',
  'unauthorized_overtime',
  'break_violation',
  'schedule_deviation',
  'no_show',
]);

export const ExceptionSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ExceptionStatusSchema = z.enum(['open', 'acknowledged', 'resolved', 'dismissed']);

export const ExceptionSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  employeeId: UUIDSchema,
  shiftId: UUIDSchema.optional(),
  punchId: UUIDSchema.optional(),
  type: ExceptionTypeSchema,
  severity: ExceptionSeveritySchema,
  status: ExceptionStatusSchema,
  description: z.string(),
  detectedAt: TimestampSchema,
  resolvedAt: TimestampSchema.optional(),
  resolvedBy: UUIDSchema.optional(),
  resolution: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Exception = z.infer<typeof ExceptionSchema>;

export const CreateExceptionSchema = ExceptionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateException = z.infer<typeof CreateExceptionSchema>;

// ============================================================================
// Schedule
// ============================================================================

export const ScheduleStatusSchema = z.enum(['draft', 'published', 'approved', 'archived']);

export const ScheduleSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema,
  departmentId: UUIDSchema.optional(),
  name: z.string().min(1).max(255),
  startDate: z.string(),
  endDate: z.string(),
  status: ScheduleStatusSchema,
  publishedAt: TimestampSchema.optional(),
  publishedBy: UUIDSchema.optional(),
  shifts: z.array(UUIDSchema).optional(),
  notes: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Schedule = z.infer<typeof ScheduleSchema>;

export const CreateScheduleSchema = ScheduleSchema.omit({
  id: true,
  publishedAt: true,
  publishedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSchedule = z.infer<typeof CreateScheduleSchema>;

// ============================================================================
// Compliance Rule (Placeholder)
// ============================================================================

export const ComplianceRuleTypeSchema = z.enum([
  'max_hours_per_day',
  'max_hours_per_week',
  'min_rest_between_shifts',
  'overtime_threshold',
  'break_requirement',
  'certification_required',
  'custom',
]);

export const ComplianceRuleSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  propertyId: UUIDSchema.optional(),
  departmentId: UUIDSchema.optional(),
  name: z.string().min(1).max(255),
  type: ComplianceRuleTypeSchema,
  description: z.string().optional(),
  configuration: z.record(z.unknown()),
  isActive: z.boolean().default(true),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type ComplianceRule = z.infer<typeof ComplianceRuleSchema>;

export const CreateComplianceRuleSchema = ComplianceRuleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateComplianceRule = z.infer<typeof CreateComplianceRuleSchema>;

// ============================================================================
// API Response Types
// ============================================================================

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.string().optional(),
  });

export type ApiResponse<T> = {
  data: T;
  error?: string;
};

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
      totalItems: z.number().int().nonnegative(),
    }),
    error: z.string().optional(),
  });

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  error?: string;
};
