# Quick Spec: Fix React Flow Provider Error

## Overview
Fix the React Flow zustand provider error by adding the missing `ReactFlowProvider` wrapper to components using the `useReactFlow()` hook. The error occurs because `FlowCanvas` and `CanvasToolbar` components use React Flow hooks without being descendants of `ReactFlowProvider`.

## Workflow Type
simple

## Task Scope
Wrap FlowCanvas and CanvasToolbar components in ReactFlowProvider to fix "Seems like you have not used zustand provider as an ancestor" error.

**Single File Change:**
- Modify `src/web/manager/components/FlowEditorVisual.tsx` to add ReactFlowProvider wrapper

**Provider Hierarchy:**
```
FlowCanvasProvider (custom state - outer)
  └─ ReactFlowProvider (React Flow zustand - middle)
      └─ FlowCanvas + CanvasToolbar (consumers - inner)
```

## Success Criteria
- [ ] No console errors about zustand provider
- [ ] FlowCanvas renders correctly without errors
- [ ] CanvasToolbar zoom controls work (they use useReactFlow)
- [ ] No existing functionality broken
- [ ] ReactFlowProvider correctly positioned in component hierarchy

## Files to Modify
- `src/web/manager/components/FlowEditorVisual.tsx` - Add ReactFlowProvider wrapper

## Change Details
Both FlowCanvas and CanvasToolbar use the `useReactFlow()` hook which requires components to be wrapped in `ReactFlowProvider`. Currently they're only wrapped in the custom `FlowCanvasProvider` for state management.

**What to do:**
1. Import `ReactFlowProvider` from `@xyflow/react`
2. Add `ReactFlowProvider` wrapper inside `FlowCanvasProvider`, wrapping the content area (lines 747-785)
3. This ensures both FlowCanvas (line 755) and CanvasToolbar (line 767) are descendants of ReactFlowProvider

## Verification
- [ ] No console errors about zustand provider
- [ ] FlowCanvas renders correctly
- [ ] CanvasToolbar zoom controls work (they use useReactFlow)
- [ ] No existing functionality broken

## Notes
- ReactFlowProvider must be inside FlowCanvasProvider (custom state) but wrapping the React Flow components
- The provider hierarchy should be: FlowCanvasProvider > ReactFlowProvider > FlowCanvas/CanvasToolbar
