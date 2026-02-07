export type EditorQuickFilter = 'openShifts' | 'unassigned';

export interface EditorQueryWindow {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  startDay: string;
}

export interface EditorQueryResult {
  quickFilter: EditorQuickFilter | null;
  days: number;
  window: EditorQueryWindow | null;
}

function normalizeQuickFilter(value: string | null): EditorQuickFilter | null {
  if (value === 'openShifts' || value === 'unassigned') {
    return value;
  }
  return null;
}

function normalizeDays(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export function parseEditorQuery(
  searchParams: URLSearchParams,
  today: Date = new Date()
): EditorQueryResult {
  const quickFilter = normalizeQuickFilter(searchParams.get('view'));
  const daysParam = normalizeDays(searchParams.get('days'));
  const days = quickFilter ? (daysParam ?? 7) : 0;

  if (!quickFilter) {
    return { quickFilter: null, days: 0, window: null };
  }

  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  end.setHours(23, 59, 59, 999);

  return {
    quickFilter,
    days,
    window: {
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startDay: start.toISOString().split('T')[0],
    },
  };
}
