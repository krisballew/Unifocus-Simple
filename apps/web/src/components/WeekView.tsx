import React from 'react';

import { useI18nContext } from '../context/I18nContext';
import { useTranslate } from '../hooks/useI18n';
import { formatDate, getScheduleWeekDays, getScheduleWeekStart } from '../utils/locale-formatters';

interface WeekViewProps {
  startDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export function WeekView({ startDate = new Date(), onDateSelect }: WeekViewProps) {
  const { config } = useI18nContext();
  const t = useTranslate();

  // Get the week start date according to tenant setting
  const weekStart = getScheduleWeekStart(startDate, config);

  // Get all days of the week in the correct order
  const weekDays = getScheduleWeekDays(weekStart, config);

  const dayLabels: Record<number, string> = {
    0: 'day.sunday',
    1: 'day.monday',
    2: 'day.tuesday',
    3: 'day.wednesday',
    4: 'day.thursday',
    5: 'day.friday',
    6: 'day.saturday',
  };

  return (
    <div style={{ width: '100%', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3>
          {t('timecard.weekOf' as never, {
            date: weekStart,
          })}
        </h3>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {weekDays.map(({ date, dayOfWeek }) => {
          const dayName = dayLabels[dayOfWeek];
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <div
              key={date.toISOString()}
              onClick={() => onDateSelect?.(date)}
              style={{
                padding: '1rem',
                border: isToday ? '2px solid #007bff' : '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: isToday ? '#e7f3ff' : '#fff',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (!isToday) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
                }
              }}
              onMouseOut={(e) => {
                if (!isToday) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
                }
              }}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>{t(dayName as never)}</div>
              <div style={{ fontSize: '1.125rem', marginTop: '0.5rem' }}>{date.getDate()}</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                {formatDate(date, config, 'short')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
