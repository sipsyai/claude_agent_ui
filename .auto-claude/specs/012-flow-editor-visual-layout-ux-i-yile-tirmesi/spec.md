# Specification: FlowEditorVisual Layout Restructure - Canvas-First UX

## Overview

The FlowEditorVisual page currently has a suboptimal layout where configuration sections (metadata, triggers) dominate the screen space, relegating the ReactFlow canvas to a cramped area. This specification outlines a comprehensive UI/UX redesign to make the canvas the primary focus (80-90% of screen real estate), moving configuration elements to collapsible sidebars and floating UI components. The goal is to create a canvas-first editing experience similar to professional workflow builders like n8n, Langflow, and Retool.

## Workflow Type

**Type**: feature

**Rationale**: This is a significant UI/UX enhancement that introduces new layout patterns and component reorganization. It adds collapsible sidebars, floating toolbars, and restructures the entire page hierarchy without changing core functionality—a classic feature enhancement workflow.

## Task Scope

### Services Involved
- **main** (primary) - Frontend React/TypeScript application containing FlowEditorVisual component

### This Task Will:
- [ ] Restructure FlowEditorVisual layout to prioritize ReactFlow canvas (80-90% screen coverage)
- [ ] Move Metadata section to collapsible left sidebar or modal/drawer
- [ ] Move Triggers section to collapsible left sidebar or modal/drawer
- [ ] Convert NodePalette to compact floating toolbar or dropdown
- [ ] Minimize top bar to show only Flow name + Save/Cancel buttons
- [ ] Relocate validation messages to toast notifications or compact banner
- [ ] Ensure full-height canvas utilization
- [ ] Maintain all existing functionality (metadata, schedule, triggers, node palette)
- [ ] Implement responsive design that adapts to different screen sizes

### Out of Scope:
- Backend API changes
- ReactFlow node functionality changes
- Flow execution logic modifications
- Database schema changes
- New feature additions beyond layout restructure

## Service Context

### main

**Tech Stack:**
- Language: TypeScript
- Framework: React
- Build Tool: Vite
- Styling: Tailwind CSS
- Package Manager: npm
- Key directories: `src/` (source), `tests/` (tests)

**Entry Point:** `src/server.ts`

**How to Run:**
```bash
npm run dev
```

**Port:** 3001

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/web/manager/components/FlowEditorVisual.tsx` | main | Primary layout restructure: move metadata/triggers to sidebar, expand canvas to 80-90% screen, minimize top bar, convert NodePalette to floating toolbar |
| Related CSS/Tailwind styles | main | Responsive layout adjustments for new sidebar-canvas-toolbar architecture |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| Existing FlowEditorVisual.tsx | Current component structure, state management patterns, and functionality hooks to preserve |
| Other collapsible components in codebase | Sidebar collapse/expand patterns if they exist |
| Toast/notification components | Patterns for displaying validation messages as non-intrusive notifications |

## Patterns to Follow

### Sidebar + Full Canvas Pattern (from n8n)

**Key Points:**
- Left sidebar contains all configuration options (metadata, triggers, schedule)
- Sidebar is collapsible with toggle button
- Canvas occupies remaining horizontal space (expands when sidebar collapses)
- Canvas always full height (100vh minus top bar)
- Configuration sections stacked vertically within sidebar with expand/collapse per section

### Minimal Top Bar (from Langflow)

**Key Points:**
- Top bar height minimal (40-50px max)
- Contains only essential actions: Flow name (editable), Save, Cancel
- No heavy form elements in top bar
- Fixed position with z-index above canvas

### Floating Toolbar (from Langflow)

**Key Points:**
- NodePalette rendered as floating overlay on canvas
- Positioned absolutely (e.g., top-left or top-right of canvas area)
- Compact design: icon-based or dropdown menu
- Dismissible or auto-hide on hover
- Does not obstruct canvas content

### Toast Notifications for Validation

**Key Points:**
- Validation errors/warnings shown as toast notifications (top-right corner typical)
- Auto-dismiss after timeout or manual close
- Non-blocking: doesn't reduce canvas area
- Stackable if multiple messages exist

## Requirements

### Functional Requirements

1. **Canvas Maximization**
   - Description: ReactFlow canvas must occupy 80-90% of viewport (full height, majority of width)
   - Acceptance: Measure canvas dimensions in browser; verify it uses ~80-90% horizontal space and 100% vertical space (minus minimal top bar)

2. **Collapsible Sidebar for Configuration**
   - Description: Metadata and Triggers sections moved to left sidebar with collapse/expand functionality
   - Acceptance: Sidebar visible by default, clicking collapse button hides it and expands canvas to near full width; clicking again restores sidebar

3. **Minimal Top Bar**
   - Description: Top bar reduced to Flow name (editable inline) + Save/Cancel buttons only
   - Acceptance: Top bar height ≤50px, contains only specified elements, no form fields for metadata/triggers

4. **Floating Node Palette**
   - Description: NodePalette converted to compact floating toolbar (icon-based or dropdown)
   - Acceptance: Palette appears as overlay on canvas (not fixed panel), can add nodes to canvas, does not reduce canvas area

5. **Toast-Based Validation Messages**
   - Description: Validation messages displayed as toast notifications instead of inline banners
   - Acceptance: Triggering a validation error shows a toast in top-right corner (or similar), message auto-dismisses or has close button, does not shrink canvas

6. **Preserve Existing Functionality**
   - Description: All current features (metadata editing, trigger configuration, schedule setup, node operations) remain fully functional
   - Acceptance: Can still edit flow name, description, tags, configure webhook/schedule triggers, add/edit/delete nodes, save flow—no functional regression

### Edge Cases

1. **Very Small Viewports (Mobile/Tablet)** - On small screens (<768px), sidebar may auto-collapse or become a modal drawer to prevent canvas from being unusable; floating toolbar may switch to bottom sheet or fixed position
2. **Long Flow Names** - If flow name is very long, truncate with ellipsis in top bar, show full name on hover tooltip or in sidebar
3. **Multiple Validation Errors** - If multiple validation errors occur, stack toasts vertically or show summary toast with expandable details
4. **Sidebar Collapse State Persistence** - Optionally persist sidebar collapse state in localStorage so user preference is remembered across sessions
5. **Accessibility** - Ensure keyboard navigation works for sidebar toggle, floating toolbar, and all form elements; screen readers should announce sidebar state changes

## Implementation Notes

### DO
- Follow existing React/TypeScript patterns in the codebase
- Use Tailwind CSS utility classes for styling (consistent with project conventions)
- Implement sidebar with smooth CSS transitions (transform/width animations)
- Use existing toast/notification library if available in project dependencies
- Test layout on various screen sizes (desktop, tablet, mobile)
- Maintain component separation: extract sidebar, top bar, and floating toolbar as separate components if complex
- Preserve all existing state management (flow metadata, triggers, nodes)
- Add data-testid attributes for new UI elements to support future testing

### DON'T
- Create inline styles—stick to Tailwind classes or CSS modules if needed
- Remove any existing functionality—this is purely a layout change
- Hardcode dimensions—use responsive units (%, vh/vw, rem)
- Introduce new dependencies without checking if existing libraries can handle requirements (e.g., check if project already has toast library)
- Break existing ReactFlow integration—canvas must remain fully functional
- Ignore accessibility—ensure keyboard and screen reader support

## Development Environment

### Start Services

```bash
# From project root
npm run dev
```

### Service URLs
- main: http://localhost:3001

### Required Environment Variables
- `ANTHROPIC_API_KEY`: API key for Claude integration (sensitive)
- `PORT`: Server port (default: 3001)
- `VITE_API_URL`: API URL for frontend (http://localhost:3001)
- See `.env` file for complete list of environment variables

## Success Criteria

The task is complete when:

1. [ ] ReactFlow canvas occupies 80-90% of screen width and full height (minus minimal top bar)
2. [ ] Metadata and Triggers sections are relocated to collapsible left sidebar
3. [ ] Sidebar can be toggled (collapsed/expanded) and canvas adjusts width accordingly
4. [ ] Top bar is minimal (≤50px height) with only Flow name + Save/Cancel buttons
5. [ ] NodePalette is rendered as floating toolbar/dropdown overlay on canvas
6. [ ] Validation messages appear as toast notifications, not inline banners
7. [ ] No console errors or warnings related to layout changes
8. [ ] Existing tests still pass (if any)
9. [ ] All original functionality preserved (metadata editing, trigger config, node operations, save/cancel)
10. [ ] Layout is responsive and functional on desktop, tablet, and mobile viewports
11. [ ] Keyboard navigation and screen reader accessibility maintained
12. [ ] Visual verification in browser shows canvas-first hierarchy (canvas dominant, config secondary)

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| FlowEditorVisual renders correctly | `tests/components/FlowEditorVisual.test.tsx` (if exists) | Component renders without errors, sidebar and canvas are present |
| Sidebar toggle functionality | `tests/components/FlowEditorVisual.test.tsx` | Clicking collapse button hides/shows sidebar, canvas width adjusts |
| Metadata form submission | `tests/components/FlowEditorVisual.test.tsx` | Metadata can still be edited and saved from sidebar |
| Trigger configuration | `tests/components/FlowEditorVisual.test.tsx` | Trigger sections functional in sidebar context |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Flow save with new layout | main | Saving flow with sidebar layout preserves all metadata and triggers correctly |
| Node addition from floating palette | main | Adding nodes via floating toolbar works identically to old palette |
| Validation error display | main | Validation errors trigger toast notifications as expected |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Create new flow with new layout | 1. Navigate to FlowEditorVisual 2. Enter flow name in top bar 3. Open sidebar 4. Fill metadata 5. Add trigger 6. Add nodes from floating palette 7. Save | Flow saved successfully with all metadata, triggers, and nodes; canvas remained primary focus throughout |
| Edit existing flow | 1. Load existing flow 2. Toggle sidebar closed 3. Verify canvas expands 4. Toggle sidebar open 5. Edit metadata 6. Save | Changes persist, sidebar toggle works smoothly, no data loss |
| Responsive behavior | 1. Resize browser to mobile width 2. Verify sidebar behavior 3. Verify canvas usability | Layout adapts gracefully, canvas remains usable, no horizontal scroll issues |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| FlowEditorVisual | `http://localhost:3001/flows/{flow-id}/edit` (or similar route) | Canvas occupies ~80-90% width, sidebar visible on left, top bar minimal, floating palette present, toasts appear on validation |
| Sidebar collapse state | `http://localhost:3001/flows/{flow-id}/edit` | Clicking collapse button animates sidebar close, canvas width increases, clicking again restores sidebar |
| Floating NodePalette | `http://localhost:3001/flows/{flow-id}/edit` | Palette appears as overlay (absolute/fixed position), does not reduce canvas area, nodes can be added |
| Validation toast | `http://localhost:3001/flows/{flow-id}/edit` | Trigger a validation error (e.g., invalid trigger config), verify toast appears, auto-dismisses or has close button |

### Database Verification (if applicable)
| Check | Query/Command | Expected |
|-------|---------------|----------|
| N/A | N/A | No database changes for this task |

### QA Sign-off Requirements
- [ ] All unit tests pass (or new tests written if none exist)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete: Canvas dominant, sidebar functional, floating palette works, toasts appear
- [ ] Database state verified: No changes expected for layout-only task
- [ ] No regressions in existing functionality (metadata, triggers, nodes, save/cancel all work)
- [ ] Code follows established patterns (React/TypeScript, Tailwind CSS)
- [ ] No security vulnerabilities introduced (no new dependencies or external resources)
- [ ] Accessibility verified: Keyboard navigation, screen reader support maintained
- [ ] Responsive design validated: Works on desktop, tablet, mobile viewports
- [ ] Performance: No noticeable lag when toggling sidebar or interacting with floating palette
