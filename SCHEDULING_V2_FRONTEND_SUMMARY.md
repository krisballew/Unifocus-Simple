# Scheduling V2 Frontend Implementation Summary

## Overview

This document describes the frontend implementation for the Scheduling V2 feature, which provides a user interface for managing schedule periods. The implementation follows the existing web application architecture and is feature-flagged behind `VITE_FEATURE_SCHEDULING_V2`.

## Implementation Details

### Feature Structure

Created a new feature folder at `apps/web/src/features/scheduleManagement/` with the following structure:

```
apps/web/src/features/scheduleManagement/
├── components/
│   ├── ScheduleStatusBadge.tsx       # Status badge component (Draft/Published/Locked)
│   ├── SchedulePeriodList.tsx        # List view with action buttons
│   └── CreateSchedulePeriodModal.tsx # Modal for creating new periods
└── pages/
    └── SchedulePeriodsPage.tsx       # Main page component
```

### API Client Extensions

Added schedule periods API functions to `apps/web/src/services/api-client.ts`:

**Types:**

- `ScheduleStatus`: Union type for period statuses ('DRAFT' | 'PUBLISHED' | 'LOCKED')
- `SchedulePeriod`: Interface matching backend DTO
- `CreateSchedulePeriodParams`: Parameters for creating periods
- `PublishSchedulePeriodParams`: Parameters for publishing periods
- `LockSchedulePeriodParams`: Parameters for locking periods
- `GetSchedulePeriodsParams`: Query parameters for listing periods

**Functions:**

- `getSchedulePeriods(params)`: Fetch schedule periods for a property
- `createSchedulePeriod(params)`: Create a new schedule period
- `publishSchedulePeriod(params)`: Publish a draft period
- `lockSchedulePeriod(params)`: Lock a published period

### Components

#### ScheduleStatusBadge

- **Purpose**: Visual indicator for period status
- **Props**: `status: ScheduleStatus`
- **Styling**: Uses existing badge classes with status-specific variants
- **Location**: [components/ScheduleStatusBadge.tsx](apps/web/src/features/scheduleManagement/components/ScheduleStatusBadge.tsx)

#### SchedulePeriodList

- **Purpose**: Table view of schedule periods with action buttons
- **Props**:
  - `periods`: Array of schedule periods
  - `onPublish`: Callback for publish action
  - `onLock`: Callback for lock action
  - `isLoading`: Loading state for disabling actions
- **Features**:
  - Displays period name, date range, status, publish/lock timestamps
  - Conditional action buttons based on status
  - Draft periods show "Publish" button
  - Published periods show "Lock" button
- **Location**: [components/SchedulePeriodList.tsx](apps/web/src/features/scheduleManagement/components/SchedulePeriodList.tsx)

#### CreateSchedulePeriodModal

- **Purpose**: Modal form for creating new schedule periods
- **Props**:
  - `propertyId`: Current property ID
  - `onClose`: Callback to close modal
  - `onCreate`: Callback with form data
  - `isLoading`: Loading state
- **Form Fields**:
  - Period Name (optional)
  - Start Date (required)
  - End Date (required, must be >= start date)
- **Location**: [components/CreateSchedulePeriodModal.tsx](apps/web/src/features/scheduleManagement/components/CreateSchedulePeriodModal.tsx)

#### SchedulePeriodsPage

- **Purpose**: Main page for schedule period management
- **Features**:
  - Uses React Query for data fetching and caching
  - Requires property selection via SelectionContext
  - Create, publish, and lock mutations with auto-refresh
  - Loading and error states
  - "Create Period" button in page header
- **Location**: [pages/SchedulePeriodsPage.tsx](apps/web/src/features/scheduleManagement/pages/SchedulePeriodsPage.tsx)

### Routing Integration

Modified [App.tsx](apps/web/src/App.tsx) to:

- Import `SchedulePeriodsPage`
- Add feature flag constant: `FEATURE_SCHEDULING_V2`
- Conditionally render based on feature flag:
  - When enabled: Shows `SchedulePeriodsPage` at `/schedules`
  - When disabled: Shows existing `PlaceholderPage`

**Navigation Entry**: The existing "Schedule Management" nav item in AppShell already points to `/schedules`, so no navigation changes were necessary.

### Styling

Added status-specific badge styles to [index.css](apps/web/src/index.css):

```css
.badge--draft {
  background: var(--uf-neutral-95);
  color: var(--uf-neutral-30);
}

.badge--published {
  background: var(--uf-pistachio-95);
  color: var(--uf-pistachio-30);
}

.badge--locked {
  background: var(--uf-teal-95);
  color: var(--uf-teal-30);
}
```

All other styles use existing CSS classes:

- `page`, `page-header`, `page-table`, `page-table__row`, `page-table__header`
- `button`, `button--primary`, `button--secondary`, `button--small`
- `modal-overlay`, `modal-content`, `modal-header`, `modal-body`, `modal-footer`
- `form-group`, `form-control`

## Feature Flag

**Environment Variable**: `VITE_FEATURE_SCHEDULING_V2`

To enable the feature, add to your `.env` file:

```
VITE_FEATURE_SCHEDULING_V2=true
```

To disable (default behavior):

```
VITE_FEATURE_SCHEDULING_V2=false
```

Or simply omit the variable.

## Usage Flow

1. **Access**: Navigate to "Schedule Management" in the sidebar (requires Manager/Admin role)
2. **Select Property**: Use property selector in header
3. **View Periods**: See list of schedule periods with statuses
4. **Create Period**:
   - Click "Create Period" button
   - Fill in start date, end date, optional name
   - Submit to create in DRAFT status
5. **Publish Period**:
   - Click "Publish" on a DRAFT period
   - Period moves to PUBLISHED status, visible to employees
6. **Lock Period**:
   - Click "Lock" on a PUBLISHED period
   - Period moves to LOCKED status, preventing further changes

## Integration with Backend

The frontend connects to these backend API endpoints:

- `GET /api/scheduling/v2/periods?propertyId={id}&start={date}&end={date}`
- `POST /api/scheduling/v2/periods`
- `POST /api/scheduling/v2/periods/{id}/publish`
- `POST /api/scheduling/v2/periods/{id}/lock`

All requests include authentication and tenant context via:

- `Authorization: Bearer {token}` header
- Automatic tenant/user ID headers in dev mode

## State Management

- **React Query**: Handles data fetching, caching, and invalidation
- **Query Key**: `['schedulePeriods', propertyId]`
- **Automatic Refresh**: Mutations invalidate queries to refresh data
- **SelectionContext**: Provides current tenant/property selection

## Error Handling

- API errors display user-friendly messages
- Loading states prevent duplicate actions
- Form validation prevents invalid date ranges
- Property selection requirement prevents unauthorized access

## Future Enhancements

This is Phase 1 (shell implementation). Future work includes:

- Schedule editor for creating shifts
- Open shifts marketplace UI
- Availability management interface
- Employee schedule view
- Shift swapping/claiming workflows

## Files Changed

### Created:

- `apps/web/src/features/scheduleManagement/components/ScheduleStatusBadge.tsx`
- `apps/web/src/features/scheduleManagement/components/SchedulePeriodList.tsx`
- `apps/web/src/features/scheduleManagement/components/CreateSchedulePeriodModal.tsx`
- `apps/web/src/features/scheduleManagement/pages/SchedulePeriodsPage.tsx`

### Modified:

- `apps/web/src/services/api-client.ts` - Added schedule periods API functions and types
- `apps/web/src/App.tsx` - Added feature-flagged routing
- `apps/web/src/index.css` - Added status badge styles

## Testing Recommendations

1. **With Feature Flag Disabled**:
   - Verify `/schedules` shows placeholder page
   - No console errors

2. **With Feature Flag Enabled**:
   - Navigate to Schedule Management
   - Test without property selection (should show prompt)
   - Select a property
   - Test creating a schedule period
   - Test publishing a draft period
   - Test locking a published period
   - Verify proper error messages on failures

3. **Role-Based Access**:
   - Test with Manager role (should have access)
   - Test with Employee role (should have limited visibility based on backend)

## Architecture Compliance

This implementation follows all specified constraints:

- ✅ No refactoring of existing web architecture
- ✅ Changes isolated to new feature folder
- ✅ Feature-flagged behind `VITE_FEATURE_SCHEDULING_V2`
- ✅ Follows existing routing conventions
- ✅ Uses existing layout/styling patterns
- ✅ Uses existing service utilities (api-client, React Query, SelectionContext)
- ✅ Only implements shell + period management (no schedule editor)
