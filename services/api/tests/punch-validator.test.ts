import { describe, it, expect } from 'vitest';

import {
  PunchValidator,
  type PunchContext,
  type ShiftWithDetails,
} from '../src/services/punch-validator';

describe('PunchValidator', () => {
  const baseShift: ShiftWithDetails = {
    id: 'shift-1',
    tenantId: 'tenant-1',
    scheduleId: 'schedule-1',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('validatePunchSequence', () => {
    it('should require first punch to be "in"', () => {
      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'out',
        timestamp: new Date(),
        recentPunches: [],
      };

      const errors = PunchValidator.validate(context);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('INVALID_FIRST_PUNCH');
    });

    it('should allow valid sequence: in -> out', () => {
      const now = new Date();
      const inPunch = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'in',
        timestamp: new Date(now.getTime() - 60000), // 1 min ago
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'out',
        timestamp: now,
        recentPunches: [inPunch],
        shift: baseShift,
      };

      const errors = PunchValidator.validate(context);
      // Should have no sequence error (might have other errors like time window)
      const sequenceError = errors.find((e) => e.code === 'INVALID_PUNCH_SEQUENCE');
      expect(sequenceError).toBeUndefined();
    });

    it('should reject invalid sequence: in -> in', () => {
      const now = new Date();
      const inPunch = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'in',
        timestamp: new Date(now.getTime() - 60000),
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'in',
        timestamp: now,
        recentPunches: [inPunch],
      };

      const errors = PunchValidator.validate(context);
      expect(errors).toContainEqual(expect.objectContaining({ code: 'INVALID_PUNCH_SEQUENCE' }));
    });
  });

  describe('validateTimeWindow', () => {
    it('should allow punch within grace period before shift', () => {
      const shiftStart = new Date();
      shiftStart.setHours(9, 0, 0, 0);

      const punchTime = new Date(shiftStart.getTime() - 10 * 60 * 1000); // 10 min before

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'in',
        timestamp: punchTime,
        shift: baseShift,
        recentPunches: [],
      };

      const errors = PunchValidator.validate(context);
      const timeError = errors.find((e) => e.code === 'TOO_EARLY');
      expect(timeError).toBeUndefined();
    });

    it('should reject punch too early before shift', () => {
      const shiftStart = new Date();
      shiftStart.setHours(9, 0, 0, 0);

      const punchTime = new Date(shiftStart.getTime() - 20 * 60 * 1000); // 20 min before

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'in',
        timestamp: punchTime,
        shift: baseShift,
        recentPunches: [],
      };

      const errors = PunchValidator.validate(context);
      expect(errors).toContainEqual(expect.objectContaining({ code: 'TOO_EARLY' }));
    });
  });

  describe('checkDuplicatePunch', () => {
    it('should detect duplicate punch within 5 seconds', () => {
      const now = new Date();
      const recentPunch = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'in',
        timestamp: new Date(now.getTime() - 2000), // 2 sec ago
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'in',
        timestamp: now,
        recentPunches: [recentPunch],
      };

      const errors = PunchValidator.validate(context);
      expect(errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_PUNCH' }));
    });

    it('should allow punch after duplicate window expires', () => {
      const now = new Date();
      const recentPunch = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'in',
        timestamp: new Date(now.getTime() - 10000), // 10 sec ago (outside 5sec window)
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'in',
        timestamp: now,
        recentPunches: [recentPunch],
      };

      const errors = PunchValidator.validate(context);
      const duplicateError = errors.find((e) => e.code === 'DUPLICATE_PUNCH');
      expect(duplicateError).toBeUndefined();
    });
  });

  describe('validateBreakRules', () => {
    it('should reject break start when break limit reached', () => {
      const now = new Date();
      const breakStart1 = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'break_start' as const,
        timestamp: new Date(now.getTime() - 31 * 60 * 1000), // 31 min ago
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const breakEnd1 = {
        id: 'punch-2',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'break_end' as const,
        timestamp: new Date(now.getTime()), // just now
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const context: PunchContext = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        punchType: 'break_start',
        timestamp: new Date(now.getTime() + 1000),
        recentPunches: [breakStart1, breakEnd1], // Start first, end second (will be paired as i=0,1)
        shift: baseShift, // 30 min break limit
      };

      const errors = PunchValidator.validate(context);
      expect(errors).toContainEqual(expect.objectContaining({ code: 'BREAK_LIMIT_EXCEEDED' }));
    });
  });

  describe('generateExceptions', () => {
    it('should generate absence exception when no punches on scheduled shift', () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);

      const exceptions = PunchValidator.generateExceptions(
        'emp-1',
        'tenant-1',
        date,
        [],
        baseShift
      );

      expect(exceptions).toContainEqual(expect.objectContaining({ type: 'absence' }));
    });

    it('should generate late_arrival exception', () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);

      const latePunch = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'in',
        timestamp: new Date(date.getTime() + 9 * 60 * 60 * 1000 + 20 * 60 * 1000), // 09:20
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const exceptions = PunchValidator.generateExceptions(
        'emp-1',
        'tenant-1',
        date,
        [latePunch],
        baseShift
      );

      expect(exceptions).toContainEqual(expect.objectContaining({ type: 'late_arrival' }));
    });

    it('should generate early_departure exception', () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);

      const inPunch = {
        id: 'punch-1',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'in',
        timestamp: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 09:00
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const outPunch = {
        id: 'punch-2',
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        shiftId: 'shift-1',
        type: 'out',
        timestamp: new Date(date.getTime() + 16 * 60 * 60 * 1000 + 30 * 60 * 1000), // 16:30 (30min early)
        latitude: null,
        longitude: null,
        deviceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const exceptions = PunchValidator.generateExceptions(
        'emp-1',
        'tenant-1',
        date,
        [inPunch, outPunch],
        baseShift
      );

      expect(exceptions).toContainEqual(expect.objectContaining({ type: 'early_departure' }));
    });
  });
});
