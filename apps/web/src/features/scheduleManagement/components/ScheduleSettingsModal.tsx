/**
 * Schedule Settings Modal
 * Configure planning period templates
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getScheduleSettings,
  updateScheduleSettings,
  type ScheduleTemplate,
  type PlanningPeriodType,
} from '../api/scheduleSettings';
import { formatApiError } from '../utils/apiErrors';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ScheduleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string | null | undefined;
  canEdit: boolean;
}

export function ScheduleSettingsModal({
  isOpen,
  onClose,
  propertyId,
  canEdit,
}: ScheduleSettingsModalProps): React.ReactElement | null {
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [initialTemplatesJson, setInitialTemplatesJson] = useState<string>('[]');
  const [draft, setDraft] = useState<ScheduleTemplate | null>(null);
  const [draftError, setDraftError] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');

  const settingsQuery = useQuery({
    queryKey: ['scheduleSettings', propertyId],
    queryFn: () => getScheduleSettings({ propertyId: propertyId! }),
    enabled: Boolean(propertyId && isOpen),
  });

  const saveMutation = useMutation({
    mutationFn: (data: ScheduleTemplate[]) =>
      updateScheduleSettings({ propertyId: propertyId!, templates: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings', propertyId] });
      // Update initial state to match saved state
      setInitialTemplatesJson(JSON.stringify(templates));
      setSaveMessage('Saved.');
    },
    onError: (error) => {
      alert(`Failed to save schedule settings: ${formatApiError(error)}`);
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      const fetchedTemplates = settingsQuery.data.templates || [];
      setTemplates(fetchedTemplates);
      setInitialTemplatesJson(JSON.stringify(fetchedTemplates));
      setSaveMessage('');
    }
  }, [settingsQuery.data]);

  const hasUnsavedChanges = useMemo(() => {
    // Check if there's an active draft being edited
    if (draft) return true;
    
    // Check if templates have been modified from initial state
    const currentJson = JSON.stringify(templates);
    return currentJson !== initialTemplatesJson;
  }, [draft, templates, initialTemplatesJson]);

  const isLoading = settingsQuery.isLoading || saveMutation.isPending;
  const hasProperty = Boolean(propertyId);

  const typeOptions: Array<{ value: PlanningPeriodType; label: string }> = [
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'BIWEEKLY', label: 'Bi-weekly' },
    { value: 'SEMIMONTHLY', label: 'Semi-monthly' },
    { value: 'MONTHLY', label: 'Monthly' },
  ];

  const summaryForTemplate = (template: ScheduleTemplate): string => {
    switch (template.type) {
      case 'WEEKLY':
        return `Weekly: ${DOW_LABELS[template.weekly?.startDow ?? 0]}–${DOW_LABELS[template.weekly?.endDow ?? 0]}`;
      case 'BIWEEKLY':
        return `Bi-weekly: ${DOW_LABELS[template.weekly?.startDow ?? 0]}–${DOW_LABELS[template.weekly?.endDow ?? 0]}`;
      case 'MONTHLY':
        return `Monthly: starts on ${template.monthly?.startDom ?? 1}`;
      case 'SEMIMONTHLY':
        return `Semi-monthly: starts on ${template.semiMonthly?.startDom ?? 1}`;
      default:
        return '';
    }
  };

  const startEdit = (template: ScheduleTemplate) => {
    setDraft({ ...template });
    setDraftError('');
    setSaveMessage('');
  };

  const createNewTemplate = () => {
    const id = `tpl_${Math.random().toString(36).slice(2, 10)}`;
    setDraft({
      id,
      name: 'New Template',
      type: 'WEEKLY',
      weekly: { startDow: 1, endDow: 0 },
    });
    setDraftError('');
    setSaveMessage('');
  };

  const validateDraft = (template: ScheduleTemplate): string => {
    if (!template.name || template.name.trim().length < 1 || template.name.length > 64) {
      return 'Name is required (1-64 characters).';
    }

    if (template.type === 'WEEKLY' || template.type === 'BIWEEKLY') {
      if (!template.weekly) {
        return 'Weekly configuration is required.';
      }
    }

    if (template.type === 'MONTHLY') {
      if (!template.monthly) {
        return 'Monthly configuration is required.';
      }
    }

    if (template.type === 'SEMIMONTHLY') {
      if (!template.semiMonthly) {
        return 'Semi-monthly configuration is required.';
      }
    }

    return '';
  };

  const saveDraft = () => {
    if (!draft) return;
    const error = validateDraft(draft);
    if (error) {
      setDraftError(error);
      return;
    }

    setTemplates((prev) => {
      const existingIndex = prev.findIndex((t) => t.id === draft.id);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = draft;
        return copy;
      }
      return [...prev, draft];
    });
    setDraft(null);
    setDraftError('');
  };

  const removeTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setSaveMessage('');
  };

  const handleSave = () => {
    if (!propertyId || !canEdit) return;
    saveMutation.mutate(templates);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) return;
    }
    setDraft(null);
    setDraftError('');
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if clicking the overlay itself, not the content
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const draftType = draft?.type || 'WEEKLY';

  const weeklyConfig = useMemo(() => ({
    startDow: draft?.weekly?.startDow ?? 1,
    endDow: draft?.weekly?.endDow ?? 0,
  }), [draft]);

  const monthlyConfig = useMemo(() => ({
    startDom: draft?.monthly?.startDom ?? 1,
  }), [draft]);

  const semiMonthlyConfig = useMemo(() => ({
    startDom: draft?.semiMonthly?.startDom ?? 1,
  }), [draft]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Settings</h2>
          <button type="button" className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {settingsQuery.isError && (
            <div className="alert alert--error">Failed to load schedule settings.</div>
          )}

          <div className="form-group">
            <div className="schedule-settings-toolbar">
              <div>
                <strong>Planning period templates</strong>
                <div className="text-muted">Define templates managers can use to create periods.</div>
              </div>
              <button
                type="button"
                className="button button--secondary"
                onClick={createNewTemplate}
                disabled={!canEdit || isLoading || !hasProperty}
              >
                Add Template
              </button>
            </div>
          </div>

          {!hasProperty && (
            <div className="alert alert--warning">
              Select a property to manage schedule settings.
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    {hasProperty
                      ? 'No templates configured yet.'
                      : 'Templates are unavailable without a selected property.'}
                  </td>
                </tr>
              )}
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{typeOptions.find((t) => t.value === template.type)?.label}</td>
                  <td>{summaryForTemplate(template)}</td>
                  <td>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => startEdit(template)}
                      disabled={!canEdit}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => removeTemplate(template.id)}
                      disabled={!canEdit}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft && (
            <div className="panel">
              <h3>{templates.find((t) => t.id === draft.id) ? 'Edit Template' : 'New Template'}</h3>
              {draftError && <div className="alert alert--error">{draftError}</div>}

              <div className="form-group">
                <label htmlFor="template-name">Name</label>
                <input
                  id="template-name"
                  className="form-control"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="form-group">
                <label htmlFor="template-type">Type</label>
                <select
                  id="template-type"
                  className="form-control"
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      type: e.target.value as PlanningPeriodType,
                    })
                  }
                  disabled={!canEdit}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {(draftType === 'WEEKLY' || draftType === 'BIWEEKLY') && (
                <div className="form-group">
                  <label>Start day-of-week</label>
                  <select
                    className="form-control"
                    value={weeklyConfig.startDow}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        weekly: {
                          startDow: Number(e.target.value),
                          endDow: weeklyConfig.endDow,
                        },
                      })
                    }
                    disabled={!canEdit}
                  >
                    {DOW_LABELS.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <label>End day-of-week</label>
                  <select
                    className="form-control"
                    value={weeklyConfig.endDow}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        weekly: {
                          startDow: weeklyConfig.startDow,
                          endDow: Number(e.target.value),
                        },
                      })
                    }
                    disabled={!canEdit}
                  >
                    {DOW_LABELS.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {draftType === 'MONTHLY' && (
                <div className="form-group">
                  <label>Start day-of-month (1-28)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={28}
                    value={monthlyConfig.startDom}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        monthly: { startDom: Number(e.target.value) },
                      })
                    }
                    disabled={!canEdit}
                  />
                </div>
              )}

              {draftType === 'SEMIMONTHLY' && (
                <div className="form-group">
                  <label>Start day-of-month (1-28)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={28}
                    value={semiMonthlyConfig.startDom}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        semiMonthly: { startDom: Number(e.target.value) },
                      })
                    }
                    disabled={!canEdit}
                  />
                  <div className="text-muted">
                    Periods split into two halves: start day + 14 days, then start day + 15 to next cycle.
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={saveDraft}
                  disabled={!canEdit}
                >
                  Save Template
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="button button--secondary" onClick={handleClose}>
            Close
          </button>
          {canEdit && (
            <button
              type="button"
              className="button button--primary"
              onClick={handleSave}
              disabled={isLoading || !hasProperty}
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          )}
          {saveMessage && <span className="text-muted">{saveMessage}</span>}
        </div>
      </div>
    </div>
  );
}
