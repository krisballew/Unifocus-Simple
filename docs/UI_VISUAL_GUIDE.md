# UI Mockup Implementation - Visual Guide

## Application Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Home] [Tab1] [Tab2]  ║ [MA] Manager  [Log out]               │ ← Row 1: Tabs + User Controls
├─────────────────────────────────────────────────────────────────┤
│ Property:  [Dropdown] ║ Mon, Jan 15 · 2:30 PM ║ ☀️ 72°F · Sunny│ ← Row 2: Property + Date/Time + Weather
├────────────────┬─────────────────────────────────────────────────┤
│  ☰              │                                                 │
│  H   Overview  │ DASHBOARD CONTENT                              │
│  📅  Schedule  │ - Stat Cards                                   │
│  🕐  Time      │ - Charts                                       │
│  👥  Employee  │ - Alerts                                       │
│  🧹  Housekeep │ - Actions                                      │
│  🔧  Maintenance                                                 │
│  👤  Admin                                                       │
│  ⚙️  Settings                                                    │
│                                                                 │
└────────────────┴─────────────────────────────────────────────────┘

When Collapsed:
┌──┬──────────────────────────────────────────────────────────────┐
│☰ │ [Tabs] ... [User] [Log out]                                 │
├──┼──────────────────────────────────────────────────────────────┤
│ H│ [Property] [Date/Time] [Weather]                            │
├──┼──────────────────────────────────────────────────────────────┤
│📅│ DASHBOARD CONTENT                                            │
│🕐│                                                              │
│👥│                                                              │
└──┴──────────────────────────────────────────────────────────────┘
```

## Header Section Details

### Row 1: Navigation & User
```
[Home ✕] [Schedule ✕] [Tab 2 ✕]  |  [MA] Manager, Manager  |  [Log out]
  ↑ Active tab highlighted
  ↑ Close button on non-Home tabs
```

### Row 2: Property & Metadata
```
Tenant: [dropdown ▼]  |  Mon, Jan 15 · 2:30 PM  |  ☀️ 72°F · Clear
Property: [dropdown ▼]
  ↑ Selects property for weather/timezone
  ↑ Date updates every minute
  ↑ Weather icon + temp + condition
```

## Sidebar States

### Expanded (260px)
```
┌──────────────┐
│ Unifocus  ←  │
├──────────────┤
│ ⌂ Home       │
│ 📅 Schedule  │
│ 🕐 Time      │
│ 👥 Employee  │
│ 🧹 Housekeep │
│ 🔧 Maint.    │
│ 👤 Admin     │
│ ⚙️  Settings │
└──────────────┘
```

### Collapsed (84px)
```
┌───┐
│ U│ ← Brand initial or icon
│ ←│ ← Expand button
├───┤
│ ⌂ │ ← Home (tooltip: "Home")
│ 📅│ ← Schedule Management
│ 🕐│ ← Time Management
│ 👥│ ← Employee Management
│ 🧹│ ← Housekeeping
│ 🔧│ ← Maintenance
│ 👤│ ← User Admin
│ ⚙️ │ ← Settings
└───┘
```

## Tab Management

### Tab Lifecycle

1. **Initial Load**
   - Home tab opens automatically

2. **Click Menu Item**
   - If page already open in tab → switch to that tab
   - If page not open → create new tab and switch to it
   - Home tab is always present

3. **Click Existing Tab**
   - Switch to that tab (navigate)

4. **Click Close (✕)**
   - Remove tab from list
   - If closed tab was active → switch to last remaining tab
   - Home tab cannot be closed

### Tab Visual States

```
[Home] [Schedule ✕] [Time ✕]    [Active tab = white bg]
 ↑      ↑
 │      └─ Not active = gray bg
 └─────── Cannot close

.tab {
  background: #f1f5f9;
  border-radius: 8px;
  padding: 8px 12px;
}

.tab--active {
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
}

.tab-close {
  margin-left: 4px;
  opacity: 0.6;
  font-size: 14px;
}
```

## Navigation Icons

All 8 menu items have professional SVG icons:

| Item | Icon | SVG Path |
|------|------|----------|
| Home | 🏠 | House shape |
| Schedule | 📅 | Calendar grid |
| Time | 🕐 | Clock face |
| Employee | 👥 | Multiple people |
| Housekeeping | 🧹 | Broom |
| Maintenance | 🔧 | Wrench |
| Admin | 👤 | Single person |
| Settings | ⚙️ | Gear/cog |

## Weather Display

### Data Flow
```
User Select Property
  ↓
geocodeAddress(address) → [latitude, longitude]
  ↓
getWeatherForLocation(lat, lon) → {temp, condition, icon}
  ↓
Display: ☀️ 72°F · Sunny
```

### Weather Conditions
- ☀️ Sunny/Clear (codes 0, 1)
- ⛅ Partly Cloudy (code 2)
- ☁️ Cloudy (code 3)
- 🌫️ Foggy (codes 45, 48)
- 🌧️ Rainy (codes 51-65, 80-82)
- ❄️ Snowing (codes 71-77, 85-86)
- ⛈️ Thunderstorm (codes 95-99)

## Branding Implementation

### Color Palette (CSS Variables)
```css
--brand-primary: #1f5cff (Blue)
--brand-secondary: #22c55e (Green)
--brand-accent: #f59e0b (Amber)
--brand-danger: #ef4444 (Red)
--brand-ink: #0f172a (Dark)
--brand-muted: #6b7280 (Gray)
```

### Icon Style
- **Base**: 24×24 viewBox
- **Colors**: Two-color design using `currentColor`
- **Background**: Hexagon gradient backdrop
- **Hover**: Slight opacity/color shift

### Card Styling
```
Stat Cards:
- Gradient background (color-coded)
- Icon, title, value, action button
- Rounded 12px corners
- Subtle shadow

Card Colors:
- Blue (#1f5cff) → Staff Active
- Orange (#f59e0b) → Employees Late
- Green (#22c55e) → Open Jobs
- Red (#ef4444) → Maintenance Issues
```

## Responsive Behavior

### Desktop (1200px+)
- Full sidebar visible
- All header sections in single row
- Tab strip can accommodate many tabs

### Tablet (768px - 1200px)
- Sidebar toggles to narrow
- Header adapts layout
- Tabs may wrap to second row

### Mobile (<768px)
- Sidebar collapses to icons only
- Header stacks vertically
- Tab strip becomes scrollable

## API Integration

### Current Weather API
**Provider:** Open-Meteo (free, no key needed)
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,weather_code
  &temperature_unit=fahrenheit
```

### Geocoding API
**Provider:** OpenStreetMap Nominatim (free)
```
GET https://nominatim.openstreetmap.org/search
  ?q={address}
  &format=json
  &limit=1
```

### Timezone API
**Provider:** TimeZoneDB
```
GET https://api.timezonedb.com/v2.1/get-time-zone
  ?key=demo
  &by=position
  &lat={lat}
  &lng={lon}
```

## User Interaction Flows

### Scenario 1: Open New Module
```
1. User in Home tab
2. Clicks "Employee Management" in sidebar
3. New tab created labeled "Employee Management"
4. Tab switches to Employee page
5. Menu item highlights active state
6. Can switch back to Home by clicking its tab
```

### Scenario 2: Change Property
```
1. User viewing Dashboard
2. Selects different property in header dropdown
3. Weather updates automatically
4. Date/time reflects new property timezone
5. Dashboard data refreshes
```

### Scenario 3: Close Tab
```
1. User has 3 tabs open
2. Clicks X on middle tab
3. Tab removed from list
4. Focus switches to adjacent tab
5. Navigation updates accordingly
```

### Scenario 4: Collapse Sidebar
```
1. User clicks < button
2. Sidebar animates from 260px → 84px
3. Labels hide, only icons visible
4. Hovering icons shows tooltip
5. Click > to expand again
```

## Accessibility Features

- Semantic HTML structure
- ARIA labels on buttons
- Keyboard navigation support
- Color not only indicator
- Icons have titles for tooltips
- Focus visible states
- Screen reader friendly

## Performance Metrics

- Weather API call: ~100-200ms
- Geocoding: ~150-300ms
- Tab switching: <50ms
- Weather cache: until property changes
- Date/time update: once per minute
- Initial load: <2s typical

## Browser Support

✅ Chrome/Chromium
✅ Firefox
✅ Safari
✅ Edge
⚠️ IE11 (not supported)

## Notes for Developers

1. Weather fetches on property selection, not periodic
2. All tabs stored in component state (not persistent)
3. Icons rendered via dangerouslySetInnerHTML
4. Sidebar toggle uses CSS transition for smooth animation
5. Weather has fallback to "Sunny, 72°F" on API failure
6. Tab close button prevents event propagation
7. Queries cached per property ID
8. Date updates every 60 seconds via useEffect interval
