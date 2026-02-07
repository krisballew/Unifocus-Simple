import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { CreateSchedulePeriodParams } from '../../../services/api-client';
import { getScheduleSettings, type ScheduleTemplate } from '../api/scheduleSettings';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CreateSchedulePeriodModalProps {
  propertyId: string;
  onClose: () => void;
  onCreate: (params: CreateSchedulePeriodParams) => void;
  isLoading?: boolean;
}

function toLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function computePeriodRange(template: ScheduleTemplate, anchorDate: string): {
  startDate: Date;
  endDate: Date;
} {
  const anchor = toLocalDate(anchorDate);

  if (template.type === 'WEEKLY' || template.type === 'BIWEEKLY') {
    const startDow = template.weekly?.startDow ?? 0;
    const endDow = template.weekly?.endDow ?? 0;
    const anchorDow = anchor.getDay();
    const startDelta = (anchorDow - startDow + 7) % 7;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - startDelta);

    if (template.type === 'BIWEEKLY') {
      const end = new Date(start);
      end.setDate(start.getDate() + 13);
      return { startDate: start, endDate: end };
    }

    const endDelta = (endDow - startDow + 7) % 7;
    const end = new Date(start);
    end.setDate(start.getDate() + endDelta);
    return { startDate: start, endDate: end };
  }

  if (template.type === 'MONTHLY') {
    const startDom = template.monthly?.startDom ?? 1;
    let year = anchor.getFullYear();
    let month = anchor.getMonth();

    if (anchor.getDate() < startDom) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }

    const start = new Date(year, month, startDom);
    const nextStart = new Date(year, month + 1, startDom);
    const end = new Date(nextStart);
    end.setDate(nextStart.getDate() - 1);
    return { startDate: start, endDate: end };
  }

  // SEMIMONTHLY
  const startDom = template.semiMonthly?.startDom ?? 1;
  let baseYear = anchor.getFullYear();
  let baseMonth = anchor.getMonth();
  const anchorDay = anchor.getDate();

  if (anchorDay < startDom) {
    baseMonth -= 1;
    if (baseMonth < 0) {
      baseMonth = 11;
      baseYear -= 1;
    }
  }

  const daysInBase = daysInMonth(baseYear, baseMonth);
  const firstHalfEnd = Math.min(startDom + 14, daysInBase);
  const secondHalfStart = Math.min(startDom + 15, daysInBase);
  const nextStart = new Date(baseYear, baseMonth + 1, startDom);
  const secondHalfEnd = new Date(nextStart);
  secondHalfEnd.setDate(nextStart.getDate() - 1);

  if (anchorDay < startDom) {
    return {
      startDate: new Date(baseYear, baseMonth, secondHalfStart),
      endDate: secondHalfEnd,
    };
  }

  if (anchorDay <= firstHalfEnd) {
    return {
      startDate: new Date(baseYear, baseMonth, startDom),
      endDate: new Date(baseYear, baseMonth, firstHalfEnd),
    };
  }

  return {
    startDate: new Date(baseYear, baseMonth, secondHalfStart),
    endDate: secondHalfEnd,
  };
}

export function CreateSchedulePeriodModal({
  propertyId,
  onClose,
  onCreate,
  isLoading = false,
}: CreateSchedulePeriodModalProps): React.ReactElement {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [anchorDate, setAnchorDate] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['scheduleSettings', propertyId],
    queryFn: () => getScheduleSettings({ propertyId }),
    enabled: Boolean(propertyId),
  });

  useEffect(() => {
    if (settingsQuery.data?.templates?.length && !templateId) {
      setTemplateId(settingsQuery.data.templates[0].id);
    }
  }, [settingsQuery.data, templateId]);

  useEffect(() => {
    if (!anchorDate) {
      const today = new Date();
      const isoDate = today.toISOString().split('T')[0];
      setAnchorDate(isoDate);
    }
  }, [anchorDate]);

  const templates = settingsQuery.data?.templates || [];
  const selectedTemplate = templates.find((t) => t.id === templateId);

  const computedRange = useMemo(() => {
    if (!selectedTemplate || !anchorDate) return null;
    return computePeriodRange(selectedTemplate, anchorDate);
  }, [selectedTemplate, anchorDate]);

  const previewLabel = useMemo(() => {
    if (!selectedTemplate) return '';
    switch (selectedTemplate.type) {
      case 'WEEKLY':
        return `Weekly: ${DOW_LABELS[selectedTemplate.weekly?.startDow ?? 0]}–${DOW_LABELS[selectedTemplate.weekly?.endDow ?? 0]}`;
      case 'BIWEEKLY':
        return `Bi-weekly: ${DOW_LABELS[selectedTemplate.weekly?.startDow ?? 0]}–${DOW_LABELS[selectedTemplate.weekly?.endDow ?? 0]}`;
      case 'MONTHLY':
        return `Monthly: starts on ${selectedTemplate.monthly?.startDom ?? 1}`;
      case 'SEMIMONTHLY':
        return `Semi-monthly: starts on ${selectedTemplate.semiMonthly?.startDom ?? 1}`;
      default:
        return '';
    }
  }, [selectedTemplate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !computedRange) return;

    const startDateTime = startOfDay(computedRange.startDate).toISOString();
    const endDateTime = endOfDay(computedRange.endDate).toISOString();

    onCreate({
      propertyId,
      startDate: startDateTime,
      endDate: endDateTime,
      name: name.trim() || undefined,
      planningTemplateId: selectedTemplate.id,
    });
  };

  const hasTemplates = templates.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Schedule Period</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="period-name">
                Period Name <span className="text-muted">(optional)</span>
              </label>
              <input
                id="period-name"
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Week of Jan 15"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="planning-template">
                Planning Template <span className="text-required">*</span>
              </label>
              <select
                id="planning-template"
                className="form-control"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={isLoading || !hasTemplates}
                required
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {!hasTemplates && (
                <div className="text-muted">
                  No planning templates configured. Ask an admin to configure Schedule Settings.
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="anchor-date">
                Anchor Date <span className="text-required">*</span>
              </label>
              <input
                id="anchor-date"
                type="date"
                className="form-control"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                required
                disabled={isLoading || !hasTemplates}
              />
              {previewLabel && <div className="text-muted">{previewLabel}</div>}
            </div>

            {computedRange && (
              <div className="form-group">
                <label>Computed Period</label>
                <div className="text-muted">
                  {computedRange.startDate.toLocaleDateString()} –{' '}
                  {computedRange.endDate.toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={isLoading || !hasTemplates || !selectedTemplate || !computedRange}
            >
              {isLoading ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
