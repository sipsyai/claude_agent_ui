# Fix Missing EyeIcon Export

## Overview

Add missing `EyeIcon` export to Icons.tsx to resolve import error in FlowsPage.tsx. FlowsPage.tsx imports `EyeIcon` from Icons.tsx (line 26), but the icon doesn't exist in the module, causing a runtime SyntaxError blocking application execution.

## Workflow Type

bugfix

## Task Scope

### Files to Modify
- `src/web/manager/components/ui/Icons.tsx` - Add EyeIcon component export

### Change Details
Add a new `EyeIcon` component following the existing icon pattern:
- SVG with 24x24 viewBox
- Uses `currentColor` for stroke
- Accepts `IconProps` parameter
- Eye/visibility icon design (circle with inner circle representing pupil)
- Match Lucide-style stroke-based design used by other icons

## Success Criteria

- [ ] No import errors on FlowsPage load
- [ ] EyeIcon renders correctly in the UI
- [ ] TypeScript compilation passes
- [ ] Existing icon imports remain functional

## Notes

- Follow existing icon naming and style conventions in Icons.tsx
- Icon should match the Lucide-style stroke-based design used by other icons
