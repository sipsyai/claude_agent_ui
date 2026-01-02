# Specification: Fix Flow Editor Critical Bugs - Auto Layout & Node Interactions

## Overview

This task addresses four critical bugs discovered during Flow Editor testing that block core functionality: (1) non-functional auto-layout feature using the dagre algorithm, (2) node clickability issues causing TimeoutErrors due to z-index/overlap problems, (3) overly restrictive save button validation preventing valid inputs from being saved, and (4) unclear node connection UX. Additionally, performance optimizations are needed to eliminate excessive API request duplication (9x calls to GET /api/flows and 4x to GET /api/strapi/agents).

## Workflow Type

**Type**: feature

**Rationale**: This is bug fixing within an existing feature (Flow Editor), addressing multiple functional defects and performance issues that prevent users from effectively using the flow builder interface.

## Task Scope

### Services Involved
- **main** (primary) - TypeScript/React frontend containing the Flow Editor feature

### This Task Will:
- [ ] Fix dagre auto-layout algorithm timing and node dimension measurement
- [ ] Resolve z-index/DOM stacking issues causing node click failures
- [ ] Adjust save button validation logic to accept valid user inputs
- [ ] Improve node connection UX with visual affordances or instructions
- [ ] Implement React Query or SWR for API request deduplication and caching
- [ ] Verify all fixes via browser testing and ensure no regressions

### Out of Scope:
- Adding new flow editor features beyond bug fixes
- Backend API changes (frontend-only scope)
- Flow execution logic or webhook functionality
- Database schema modifications

## Service Context

### main

**Tech Stack:**
- Language: TypeScript
- Framework: React
- Build Tool: Vite
- Styling: Tailwind CSS
- Package Manager: npm
- Key directories: `src/` (source code), `tests/` (tests)

**Entry Point:** `src/server.ts`

**How to Run:**
```bash
npm run dev
```

**Port:** 3001

**Key Dependencies:**
- React Flow (visual flow editor)
- `@types/dagre` (already installed - type definitions)
- `@dagrejs/dagre` (needs installation - v1.1.8, actively maintained)
- TanStack Query or SWR (for API caching - to be chosen)

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/web/manager/utils/auto-layout.ts` | main | Fix dagre layout timing - ensure nodes have dimensions before layout calculation. Implement render → measure → layout → re-render cycle |
| Flow editor node rendering components | main | Fix z-index/CSS stacking context issues preventing node clicks. Identify and resolve DOM overlap problems |
| Save validation logic | main | Relax overly restrictive validation rules blocking valid inputs |
| API request hooks (flows, agents) | main | Implement React Query or SWR to deduplicate GET /api/flows and GET /api/strapi/agents calls |
| Node connection UI components | main | Add visual affordances (e.g., connection handles, hover states, tooltips) to clarify how nodes connect |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/web/manager/utils/auto-layout.ts` | Current dagre integration - review for timing bugs |
| React Flow documentation | React Flow lifecycle hooks (e.g., `onNodesInitialized`, `useNodesInitialized`) for proper layout timing |
| Existing API hook implementations | Pattern for current API calls to understand where to inject caching layer |

## Patterns to Follow

### Dagre Auto-Layout with React Flow

**Critical Issue:** Nodes render at default positions BEFORE dimensions are measured, breaking layout calculations.

**Required Timing Sequence:**
```typescript
// 1. Initialize nodes with default positions
const [nodes, setNodes] = useState(initialNodes);

// 2. Let React Flow render to measure dimensions
// (React Flow will calculate node widths/heights)

// 3. Run dagre.layout() with measured dimensions
const layoutNodes = (nodes) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',  // top-to-bottom
    nodesep: 50,    // node separation
    ranksep: 50     // rank separation
  });

  // Add nodes with measured dimensions
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.width || 200,   // Use measured width
      height: node.height || 100  // Use measured height
    });
  });

  // Add edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // 4. Update node positions with calculated values
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x,
        y: nodeWithPosition.y,
      },
    };
  });
};

// 5. Re-render with new positions using React Flow hook
const { fitView } = useReactFlow();
useEffect(() => {
  // Wait for nodes to be initialized
  if (nodesInitialized) {
    const layoutedNodes = layoutNodes(nodes);
    setNodes(layoutedNodes);
    fitView();
  }
}, [nodesInitialized]);
```

**Key Points:**
- Nodes MUST have width/height before dagre.layout() runs
- For dynamic nodes: render with `opacity: 0` → layout → set `opacity: 1`
- Parent-child nodes: calculate child positions relative to parent
- Use React Flow's `onNodesInitialized` hook or similar for timing

### React Query API Deduplication

**Installation:**
```bash
npm install @tanstack/react-query@5.90.16
```

**Provider Setup:**
```typescript
// App root
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* app content */}
    </QueryClientProvider>
  );
}
```

**Hook Pattern:**
```typescript
// API hook
import { useQuery } from '@tanstack/react-query';

export function useFlows() {
  return useQuery({
    queryKey: ['flows'],
    queryFn: async () => {
      const response = await fetch('/api/flows');
      return response.json();
    },
  });
}

// Usage - 9 calls with same key = 1 network request
const { data: flows, isLoading } = useFlows();
```

**Key Points:**
- Query keys must be stable arrays
- Default staleTime=0 (data immediately stale)
- 3 simultaneous requests with same key = 1 network call, 1 promise, 3 resolutions
- Granular caching control

## Requirements

### Functional Requirements

1. **Auto-Layout Fix**
   - Description: Dagre algorithm properly calculates and applies node positions in the flow editor
   - Acceptance: Clicking "Auto Layout" button arranges nodes in hierarchical layout without overlap

2. **Node Clickability Fix**
   - Description: All nodes (Agent, Skill, etc.) are clickable without TimeoutErrors
   - Acceptance: Clicking any node opens its configuration panel within 500ms

3. **Save Button Validation Fix**
   - Description: Save button enables when flow has valid name and at least one node
   - Acceptance: Users can save flows with valid minimal data; no false-negative validation errors

4. **Node Connection UX Enhancement**
   - Description: Users understand how to connect nodes via visual affordances
   - Acceptance: Connection handles visible on hover, tooltips explain drag-to-connect behavior

5. **API Request Deduplication**
   - Description: Duplicate API calls eliminated via caching layer
   - Acceptance: GET /api/flows called once per page load (not 9x), GET /api/strapi/agents called once (not 4x)

### Edge Cases

1. **Dynamic Node Sizing** - Nodes with variable content must be measured after render before auto-layout runs
2. **Nested/Parent-Child Nodes** - Child node positions must be calculated relative to parent in layout algorithm
3. **Empty Flows** - Auto-layout gracefully handles flows with 0 or 1 nodes
4. **Concurrent API Calls** - React Query correctly deduplicates simultaneous requests from multiple components
5. **Z-index Conflicts** - Modal dialogs and tooltips remain above flow canvas without breaking node clicks

## Implementation Notes

### DO
- Install `@dagrejs/dagre@1.1.8` (not deprecated `dagre` package - 6 years unmaintained)
- Use React Flow's `onNodesInitialized` or `useNodesInitialized` hook for layout timing
- Measure node dimensions before running `dagre.layout()`
- Implement React Query with stable query keys (arrays)
- Inspect browser DevTools Network tab to verify API deduplication works
- Test z-index issues by checking CSS specificity and stacking contexts
- Add data-testid attributes to connection handles for automated testing

### DON'T
- Call dagre.layout() before nodes have measured widths/heights
- Use deprecated `dagre` package (use `@dagrejs/dagre` instead)
- Hardcode node dimensions - measure actual rendered sizes
- Implement custom caching when React Query/SWR handles it automatically
- Change backend API contracts - this is frontend-only work
- Skip browser verification - automated tests may miss visual/interaction bugs

## Development Environment

### Start Services

```bash
# Start frontend dev server
npm run dev

# Application will be available at:
# http://localhost:3001
```

### Service URLs
- Frontend: http://localhost:3001
- API Base: http://localhost:3001/api
- Flow Editor: http://localhost:3001/manager/flows (assumed path)

### Required Environment Variables

Critical variables from `.env`:
- `VITE_EXPRESS_URL`: http://localhost:3001/api
- `VITE_STRAPI_URL`: http://localhost:1337/api
- `VITE_API_URL`: http://localhost:3001
- `ANTHROPIC_API_KEY`: <redacted> (required for backend)
- `PORT`: 3001
- `NODE_ENV`: development

## Success Criteria

The task is complete when:

1. [ ] Auto Layout button arranges nodes in hierarchical dagre layout without overlap
2. [ ] All node types (Agent, Skill, Trigger, etc.) respond to clicks within 500ms
3. [ ] Save button enables for valid flows (name + ≥1 node)
4. [ ] Connection handles visible on node hover with tooltips explaining usage
5. [ ] GET /api/flows called max 1x per page load (verified via Network tab)
6. [ ] GET /api/strapi/agents called max 1x per page load (verified via Network tab)
7. [ ] No console errors in browser DevTools
8. [ ] Existing Flow Editor tests still pass
9. [ ] Manual browser testing confirms all 4 bugs fixed

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Auto-layout timing | `auto-layout.test.ts` | dagre.layout() receives nodes with measured dimensions |
| Query key stability | `api-hooks.test.ts` | useFlows() and useAgents() return stable query keys |
| Save validation | `flow-validation.test.ts` | Valid flows pass validation, invalid flows rejected |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| API deduplication | main ↔ Express API | Multiple useFlows() calls = 1 network request |
| Flow save roundtrip | main ↔ Express API | Flow saved with valid data persists correctly |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Create & Auto-Layout Flow | 1. Create flow 2. Add 3+ nodes 3. Click Auto Layout | Nodes arranged in hierarchical top-to-bottom layout |
| Node Click & Configure | 1. Open flow 2. Click Agent node 3. Modify settings | Configuration panel opens within 500ms, changes save |
| Connect Nodes | 1. Hover over node 2. Drag connection handle to target | Connection created, visual feedback during drag |
| Save Valid Flow | 1. Create flow with name + 2 nodes 2. Click Save | Save button enabled, flow saves without errors |

### Browser Verification (Frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Flow Editor | `http://localhost:3001/manager/flows` | Auto-layout works, nodes clickable, save enabled |
| Flow List | `http://localhost:3001/manager/flows` | API calls deduplicated (Network tab: 1 call to /api/flows) |
| Node Configuration | `http://localhost:3001/manager/flows/:id` | Z-index correct, no overlay blocking clicks |

### Database Verification (if applicable)
| Check | Query/Command | Expected |
|-------|---------------|----------|
| Flow persistence | SQLite query: `SELECT * FROM flows WHERE name = 'Test Flow'` | Flow saved with correct nodes/edges JSON |

### Performance Verification
| Metric | Tool | Target |
|--------|------|--------|
| API call count | Browser Network tab | GET /api/flows: 1x, GET /api/strapi/agents: 1x |
| Node click response | Browser Performance tab | < 500ms from click to panel open |
| Auto-layout execution | Console timing | < 1000ms for graphs with <50 nodes |

### QA Sign-off Requirements
- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass
- [ ] All E2E tests pass (Playwright/Cypress if available)
- [ ] Browser verification complete - all 4 bugs confirmed fixed
- [ ] Network tab shows API deduplication working (1 call per endpoint)
- [ ] No regressions in existing Flow Editor functionality
- [ ] Code follows established TypeScript/React patterns
- [ ] No new console errors or warnings
- [ ] No security vulnerabilities introduced (z-index doesn't expose sensitive UI)
- [ ] Performance targets met (API calls reduced from 9x/4x to 1x each)

## Additional Context

### Research Findings

**Dagre Package Decision:**
- Use `@dagrejs/dagre` v1.1.8 (actively maintained)
- Old `dagre` package is deprecated (6 years unmaintained)
- Install: `npm i @dagrejs/dagre`

**React Query vs SWR:**
- React Query: More features, better TypeScript, granular caching control
- SWR: Simpler API, smaller bundle, 2000ms deduping interval
- **Recommendation**: React Query for complex needs (this project has multiple API endpoints)

**Z-index Issue:**
- Not related to dagre or caching libraries
- Likely React Flow CSS stacking context issue
- Check React Flow's default CSS classes and custom node styling

### Known Constraints

- Must maintain backward compatibility with existing flows in database
- Flow execution engine should remain unchanged
- No breaking changes to Flow Editor public API
- Must work with existing Strapi backend without modifications
