import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useSelection } from '../context/SelectionContext';
import { getPunches, getSchedules, type Punch } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

export function TimecardPage(): React.ReactElement {
  const { selectedTenantId } = useSelection();

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules(),
    queryFn: getSchedules,
    enabled: Boolean(selectedTenantId),
  });

  const selectedEmployee = schedulesQuery.data?.[0];

  const punchesQuery = useQuery({
    queryKey: queryKeys.punches(selectedEmployee?.employeeId, undefined, undefined),
    queryFn: () => getPunches(selectedEmployee?.employeeId),
    enabled: Boolean(selectedEmployee?.employeeId),
  });

  if (schedulesQuery.isLoading || punchesQuery.isLoading) {
    return <LoadingSkeleton lines={8} card />;
  }

  const punches = punchesQuery.data ?? [];

  // Group punches by day
  const punchesByDay = new Map<string, Punch[]>();
  for (const punch of punches) {
    const day = new Date(punch.timestamp).toLocaleDateString();
    if (!punchesByDay.has(day)) {
      punchesByDay.set(day, []);
    }
    punchesByDay.get(day)?.push(punch);
  }

  const calculateHours = (dayPunches: Punch[]) => {
    const inPunches = dayPunches.filter((p) => p.type === 'in');
    const outPunches = dayPunches.filter((p) => p.type === 'out');

    if (inPunches.length === 0 || outPunches.length === 0) {
      return null;
    }

    let totalMs = 0;
    let breakMs = 0;

    for (let i = 0; i < inPunches.length; i++) {
      const inPunch = inPunches[i];
      if (!inPunch) continue;
      const inTime = new Date(inPunch.timestamp).getTime();
      const outPunch = outPunches[i];
      const outTime = outPunch ? new Date(outPunch.timestamp).getTime() : Date.now();
      totalMs += outTime - inTime;
    }

    // Sum break times
    for (let i = 0; i < dayPunches.length; i += 2) {
      const start = dayPunches[i];
      const end = dayPunches[i + 1];
      if (start?.type === 'break_start' && end?.type === 'break_end') {
        breakMs += new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime();
      }
    }

    const workMs = totalMs - breakMs;
    return (workMs / (1000 * 60 * 60)).toFixed(2);
  };

  return (
    <div className="timecard">
      <div className="timecard-header">
        <h2>Timecard</h2>
        <p className="timecard-employee">
          {selectedEmployee?.employeeId ?? 'No employee selected'}
        </p>
      </div>

      {punches.length === 0 ? (
        <p className="timecard-empty">No punches recorded</p>
      ) : (
        <div className="timecard-table">
          <div className="timecard-table-header">
            <div>Date</div>
            <div>In</div>
            <div>Out</div>
            <div>Break</div>
            <div>Hours</div>
          </div>

          {Array.from(punchesByDay.entries()).map(([day, dayPunches]) => {
            const inPunch = dayPunches.find((p) => p.type === 'in');
            const outPunch = dayPunches.find((p) => p.type === 'out');
            const breakStart = dayPunches.find((p) => p.type === 'break_start');
            const breakEnd = dayPunches.find((p) => p.type === 'break_end');

            return (
              <div className="timecard-table-row" key={day}>
                <div className="timecard-date">{day}</div>
                <div className="timecard-time">
                  {inPunch
                    ? new Date(inPunch.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </div>
                <div className="timecard-time">
                  {outPunch
                    ? new Date(outPunch.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </div>
                <div className="timecard-break">
                  {breakStart && breakEnd
                    ? `${new Date(breakStart.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(breakEnd.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : '—'}
                </div>
                <div className="timecard-hours">{calculateHours(dayPunches) ?? '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
