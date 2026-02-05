# Quick Start - Testing the UI Mockup Implementation

## Starting the Application

### Prerequisites
```bash
# Ensure dependencies are installed
cd /workspaces/Unifocus-Simple
pnpm install
```

### Start Backend API
```bash
cd services/api
pnpm dev
# API will run on http://localhost:3001
```

### Start Frontend App
```bash
cd apps/web
pnpm dev
# App will run on http://localhost:5173
```

### Access the Application
```
Open browser: http://localhost:5173
```

## Features to Test

### 1. **Tab System** ⭐ NEW
- [ ] Home tab appears by default
- [ ] Click "Schedule Management" → New tab opens
- [ ] Click "Employee Management" → Another new tab opens
- [ ] Tabs show as: [Home] [Schedule Management ✕] [Employee Management ✕]
- [ ] Click ✕ on a tab → Tab closes
- [ ] Click existing tab → Switches to that page
- [ ] Home tab cannot be closed (no ✕ button)

### 2. **Weather Display** ⭐ NEW
- [ ] Header shows weather: "☀️ 72°F · Sunny"
- [ ] Weather updates when you change property
- [ ] Weather shows correct condition icon
- [ ] If API fails, shows "☀️ 72°F · Loading..."

### 3. **Date/Time Display**
- [ ] Shows current date: "Mon, Jan 15"
- [ ] Shows current time: "2:30 PM" (etc)
- [ ] Updates every minute (watch it change)
- [ ] Formatted correctly

### 4. **Property Selector**
- [ ] Header has "Tenant:" and "Property:" dropdowns
- [ ] Can select different properties
- [ ] Weather updates when you change property
- [ ] Selection persists while navigating

### 5. **User Controls** 
- [ ] Avatar shows user initials in gradient circle
- [ ] User name displays
- [ ] User role displays (e.g., "Manager")
- [ ] "Log out" button visible and clickable

### 6. **Navigation Icons** ⭐ NEW
- [ ] Home icon (house shape)
- [ ] Calendar icon (grid)
- [ ] Clock icon (clock face)
- [ ] Users icon (multiple people)
- [ ] Broom icon (cleaning tool)
- [ ] Wrench icon (tool)
- [ ] User icon (single person)
- [ ] Cog icon (settings gear)

### 7. **Sidebar Collapse** ⭐ NEW
- [ ] Click ◀ button → Sidebar narrows to 84px
- [ ] Menu labels disappear, icons remain
- [ ] Hover over icons → Tooltips show full labels
- [ ] Click ▶ button → Sidebar expands back to 260px
- [ ] Labels reappear
- [ ] Smooth animation (not instant)

### 8. **HomePage**
- [ ] Title shows just "Overview" (not redundant info)
- [ ] No "Current Property" metadata box
- [ ] No "Manager" info box
- [ ] Dashboard content (stat cards) still visible
- [ ] Cleaner, more spacious layout

## API Integrations to Verify

### Weather API
```
Check Network tab in DevTools:
GET https://api.open-meteo.com/v1/forecast
  ?latitude=40.7128
  &longitude=-74.0060
  &current=temperature_2m,weather_code
  &temperature_unit=fahrenheit
```

### Geocoding API
```
Check Network tab in DevTools:
GET https://nominatim.openstreetmap.org/search
  ?q=123+Main+Street,+Springfield,+IL+62701
  &format=json
  &limit=1
```

## Browser DevTools Debugging

### Console
- Should show NO errors related to weather or geocoding
- Location updates should log smoothly

### Network Tab
- Look for calls to open-meteo.com (~100-200ms)
- Look for calls to nominatim.openstreetmap.org (~150-300ms)
- Look for failed requests and check cache

### Elements Inspector
- Check `.topbar` has two rows
- Check `.tab` elements have close buttons
- Check `.sidebar` CSS transitions on width changes
- Check `.nav-icon` SVG rendering

### Performance
- Tab switching: <50ms
- Weather update: <300ms
- Initial load: <2s

## Troubleshooting

### Weather Shows "Loading..."
**Problem:** Weather API not responding
**Solution:** 
- Check internet connection
- Verify property has valid address
- Check Network tab for CORS errors
- May need to wait for geocoding to complete first

### Tabs Not Opening
**Problem:** Clicking menu items doesn't create tabs
**Solution:**
- Check console for JavaScript errors
- Verify navigation is working (URL changes)
- Refresh page and try again

### Icons Not Showing
**Problem:** Sidebar shows squares instead of icons
**Solution:**
- Hard refresh browser (Ctrl+Shift+R)
- Check console for SVG errors
- Verify dangerouslySetInnerHTML is working

### Sidebar Collapse Button Not Working
**Problem:** ◀/▶ button doesn't toggle sidebar
**Solution:**
- Check browser console for errors
- Verify CSS transition is enabled
- Check if sidebar-toggle button has click handler

## Performance Testing

### Measure Weather Performance
```javascript
// In browser console:
console.time('weather');
// Change property...
console.timeEnd('weather'); // Should be <300ms
```

### Measure Tab Switching
```javascript
// In browser console:
console.time('tab-switch');
// Click different tab...
console.timeEnd('tab-switch'); // Should be <50ms
```

## Responsive Testing

### Test Sidebar on Mobile
1. Open DevTools (F12)
2. Click "Device Toolbar" or Ctrl+Shift+M
3. Select "iPhone 12" or similar
4. Verify sidebar collapses automatically
5. Check icons still visible
6. Verify tab strip wraps properly

### Test on Different Screen Sizes
- [ ] Desktop (1920×1080) - Full layout
- [ ] Tablet (768×1024) - Sidebar toggles
- [ ] Mobile (375×812) - Compact layout
- [ ] Ultra-wide (3440×1440) - Full width

## Feature Demonstrations

### Demonstrate Tab System
1. Start on Home page
2. Click "Schedule Management" menu item
3. Point out new tab created: [Home] [Schedule Management ✕]
4. Click Home tab
5. Back at home
6. Click Schedule tab again
7. Back at schedule
8. Click ✕ on Schedule tab
9. Tab closes, only Home remains

### Demonstrate Weather Integration
1. Note weather in top-right: "☀️ 72°F · Sunny"
2. Click property selector dropdown
3. Select different property
4. Watch weather update to new location
5. Repeat with 2-3 different properties
6. Show weather changes match property location

### Demonstrate Sidebar
1. Show expanded sidebar with 8 menu items
2. Click ◀ button
3. Sidebar collapses to just icons
4. Point out icons match menu items
5. Hover over first icon
6. Show tooltip: "Home"
7. Click ▶ to expand
8. Labels reappear

## Code Review Checklist

- [ ] No TypeScript errors (run: `pnpm tsc`)
- [ ] No console errors/warnings
- [ ] All imports resolved
- [ ] New services functional (weather, geocoding)
- [ ] AppShell properly manages tabs
- [ ] PropertySelector has callback
- [ ] HomePage cleanup complete
- [ ] CSS properly styled
- [ ] Icons render correctly
- [ ] No performance issues

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Weather shows "Loading..." | API slow/failed | Wait, check connection, refresh |
| Tabs not creating | State issue | Check console, refresh page |
| Icons look broken | SVG rendering | Hard refresh, check SVG HTML |
| Sidebar flickers | CSS transition | Check display property, verify animation |
| Date doesn't update | Interval not set | Check useEffect, refresh page |
| Weather wrong location | Geocoding failed | Check property address format |

## Video/Screen Recording Tips

If recording a demo:
1. Start with browser zoom at 100%
2. Open DevTools Network tab (shows API calls)
3. Slow down Network (throttle to 3G) to show real loading
4. Click through all features
5. Show responsiveness on mobile
6. Highlight new features with text overlays

## Success Criteria

✅ All tabs create, switch, and close properly
✅ Weather displays and updates correctly
✅ Icons render for all menu items
✅ Sidebar collapse/expand works smoothly
✅ Date/time updates every minute
✅ HomePage is clean and uncluttered
✅ No console errors
✅ Performance is snappy (<300ms for all operations)
✅ Responsive on mobile/tablet
✅ All APIs are being called correctly

---

**Implementation Complete! The app now matches the mockup with all required features.**
