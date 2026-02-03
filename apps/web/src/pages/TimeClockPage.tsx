import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useTranslate, useTimeFormatter, useRelativeTimeFormatter } from '../hooks/useI18n';
import { getCurrentUser, recordPunch, getSchedules, type Punch } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

export function TimeClockScreen(): React.ReactElement {
  const [lastPunch, setLastPunch] = useState<Punch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslate();
  const formatTime = useTimeFormatter();
  const formatRelativeTime = useRelativeTimeFormatter();

  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
  });

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules(),
    queryFn: getSchedules,
  });

  const punchMutation = useMutation({
    mutationFn: (type: 'in' | 'out' | 'break_start' | 'break_end') => {
      if (!userQuery.data?.userId) {
        throw new Error('User not loaded');
      }

      const schedule = schedulesQuery.data?.[0];
      return recordPunch(userQuery.data.userId, type, schedule?.shifts?.[0]?.id);
    },
    onSuccess: (punch) => {
      setLastPunch(punch);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('common.error'));
    },
  });

  if (userQuery.isLoading || schedulesQuery.isLoading) {
    return <LoadingSkeleton lines={6} card />;
  }

  const lastPunchType = lastPunch?.type;
  const getPunchLabel = (type: string) => {
    switch (type) {
      case 'in':
        return t('timeclock.punchIn');
      case 'out':
        return t('timeclock.punchOut');
      case 'break_start':
        return t('timeclock.breakStart');
      case 'break_end':
        return t('timeclock.breakEnd');
      default:
        return type;
    }
  };

  const getNextPunchOptions = () => {
    if (!lastPunchType) {
      return [{ type: 'in' as const, label: t('timeclock.punchIn') }];
    }

    const options: Array<{ type: 'in' | 'out' | 'break_start' | 'break_end'; label: string }> = [];
    switch (lastPunchType) {
      case 'in':
        options.push({ type: 'break_start', label: t('timeclock.breakStart') });
        options.push({ type: 'out', label: t('timeclock.punchOut') });
        break;
      case 'out':
        options.push({ type: 'in', label: t('timeclock.punchIn') });
        break;
      case 'break_start':
        options.push({ type: 'break_end', label: t('timeclock.breakEnd') });
        break;
      case 'break_end':
        options.push({ type: 'break_start', label: t('timeclock.breakStart') });
        options.push({ type: 'out', label: t('timeclock.punchOut') });
        break;
    }
    return options;
  };

  const nextOptions = getNextPunchOptions();

  return (
    <div className="time-clock">
      <div className="time-clock__display">
        <div className="time-clock__time">{formatTime(new Date())}</div>
        <div className="time-clock__date">
          {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {lastPunch && (
        <div className="time-clock__status">
          <p className="time-clock__status-label">
            {t('timeclock.lastPunch', { time: formatTime(lastPunch.timestamp) })}
          </p>
          <p className="time-clock__status-value">{getPunchLabel(lastPunch.type)}</p>
          <p className="time-clock__status-time">{formatRelativeTime(lastPunch.timestamp)}</p>
        </div>
      )}

      {error && (
        <div className="time-clock__error">
          <p>{error}</p>
        </div>
      )}

      <div className="time-clock__buttons">
        {nextOptions.map((option) => (
          <button
            key={option.type}
            className={`time-clock__btn time-clock__btn--${option.type}`}
            onClick={() => punchMutation.mutate(option.type)}
            disabled={punchMutation.isPending}
            type="button"
          >
            {punchMutation.isPending ? 'Recording...' : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
