# Specification: Create Frontend Tests and Bug Tracking Task

## Overview

This task involves creating a comprehensive test suite for the Claude Agent UI frontend application using Vitest and React Testing Library. The frontend is a React 18 application built with TypeScript, Vite, and Tailwind CSS that serves as the UI for managing AI agents, skills, and flows. As tests are created, any bugs discovered during the testing process should trigger the creation of new bug-fix tasks in the auto-claude system for separate remediation, ensuring that testing and bug-fixing remain decoupled workflows.

## Workflow Type

**Type**: Testing

**Rationale**: This task is focused on test creation and quality assurance validation. The integrated bug-tracking requirement indicates a sophisticated testing approach where test creation is the primary objective, with bug reporting as a secondary workflow trigger. This separation of concerns (testing vs. bug-fixing) aligns with the specified workflow type.

## Task Scope

### Services Involved
- **Frontend (main)** (primary) - React/TypeScript/Vite application serving as the primary UI for the Claude Agent system

### This Task Will:
- [ ] Install testing framework dependencies (Vitest, React Testing Library, jsdom, @testing-library/jest-dom)
- [ ] Create vitest configuration file with proper jsdom environment setup
- [ ] Create test setup file with jest-dom matchers registration
- [ ] Add test scripts to package.json for unit test execution
- [ ] Create sample unit tests for core frontend components
- [ ] Document testing patterns and conventions for the project
- [ ] Establish CI/CD test automation hooks if applicable
- [ ] Create bug-reporting mechanism for issues discovered during testing

### Out of Scope:
- E2E testing with Playwright (optional enhancement, not required for initial phase)
- Backend/API endpoint testing
- Performance profiling or load testing
- Coverage threshold enforcement configuration
- Integration with external testing services (e.g., Sauce Labs, BrowserStack)

## Service Context

### Frontend (Main)

**Tech Stack:**
- Language: TypeScript 5.3.3
- Framework: React 18.2.0
- Build Tool: Vite 7.0.6
- UI Components: Radix UI (accessibility-focused)
- Styling: Tailwind CSS
- Key directories:
  - `src/` - Source code
  - `tests/` - Test files

**Entry Point:** `src/server.ts`

**How to Run:**
```bash
npm run dev
```

**Port:** 3001

**Key Dependencies:**
- @radix-ui/react-* (checkbox, dialog, label, popover, select, slot, switch, tabs, tooltip)
- @assistant-ui/react and @assistant-ui/react-markdown
- @anthropic-ai/sdk and @anthropic-ai/claude-agent-sdk

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `package.json` | Frontend | Add vitest, testing-library, and jsdom dev dependencies; add test scripts |
| `vitest.config.ts` | Frontend | Create new configuration file with jsdom environment and setupFiles setting |
| `src/test/setup.ts` | Frontend | Create new setup file with jest-dom matchers registration |
| `tests/` | Frontend | Create unit test files for components and utilities |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/components/` | Component structure and composition patterns |
| `src/pages/` | Page-level component organization |
| `src/hooks/` | Custom React hooks patterns |
| `src/utils/` | Utility function patterns |
| `src/services/` | Service/API integration patterns |

## Patterns to Follow

### Component Testing Pattern

From `src/components/`:

```typescript
// Use React Testing Library with semantic queries
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ComponentName', () => {
  it('should render with expected content', () => {
    render(<Component prop="value" />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('should handle async operations', async () => {
    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/loaded/i)).toBeInTheDocument();
    });
  });
});
```

**Key Points:**
- Use `screen` queries (getByRole, getByText, etc.) instead of container selectors
- Prefer semantic queries based on user-visible attributes (role, text, label)
- Use `userEvent` for realistic user interaction simulation
- Use `waitFor()` for async operations and state updates
- Test behavior, not implementation details

### Radix UI Component Testing

Since the project uses Radix UI:

```typescript
// Radix components expose standard roles (button, dialog, etc.)
import { Dialog, DialogTrigger, DialogContent } from '@radix-ui/react-dialog';

describe('RadixDialog', () => {
  it('should open on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>Dialog content</DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(screen.getByText(/dialog content/i)).toBeInTheDocument();
  });
});
```

**Key Points:**
- Radix UI components properly expose WAI-ARIA roles
- Test accessibility attributes (roles, labels, states)
- Leverage built-in accessibility features

## Requirements

### Functional Requirements

1. **Test Framework Installation**
   - Description: Install Vitest and required testing dependencies (React Testing Library, jsdom, jest-dom)
   - Acceptance: All dependencies listed in package.json; npm install succeeds without errors

2. **Test Configuration**
   - Description: Create vitest.config.ts with jsdom environment and proper setup file configuration
   - Acceptance: vitest.config.ts exists; vitest --run executes without configuration errors

3. **Component Test Coverage**
   - Description: Write tests for core React components following React Testing Library best practices
   - Acceptance: At least 10-15 test files created covering major components; tests pass with --run flag

4. **Test Scripts in Package.json**
   - Description: Add npm scripts for running tests (test, test:watch, test:ui, test:coverage)
   - Acceptance: npm test, npm run test:watch, npm run test:ui all work correctly

5. **Bug Discovery and Tracking**
   - Description: During test creation, document any bugs found and create tasks in auto-claude system
   - Acceptance: Any discovered bugs result in new task creation with clear reproduction steps; bugs are logged with severity level

### Edge Cases

1. **Async Component Loading** - Use `waitFor()` with appropriate timeout values to handle slow async operations
2. **Radix UI Portal Elements** - Test components that render outside DOM tree using Radix's portal mechanism
3. **Form Input Testing** - Use `userEvent` instead of `fireEvent` for realistic input simulation
4. **Navigation and Routing** - Mock or wrap components with routing context if they depend on route params
5. **API Integration** - Mock fetch/axios calls in tests to avoid external dependencies
6. **State Management** - Test with required context providers and state initialization
7. **Accessibility** - Verify ARIA roles, labels, and keyboard navigation work correctly

## Implementation Notes

### DO
- Follow React Testing Library best practices: test user behavior, not implementation
- Use semantic queries (getByRole, getByLabelText, getByText) to identify elements
- Import jest-dom matchers from '@testing-library/jest-dom/vitest' in setup file
- Use `userEvent` for all user interactions (clicks, typing, form submissions)
- Wrap async tests with `waitFor()` for state updates and data fetching
- Test Radix UI components using their exposed ARIA roles
- Group related tests in describe blocks
- Name test files consistently: `ComponentName.test.ts` or `ComponentName.spec.ts`
- Keep tests focused and independent (no shared state between tests)
- Document test purpose with clear, descriptive test names

### DON'T
- Use `fireEvent` - it doesn't simulate user behavior realistically
- Query elements by test IDs unless absolutely necessary (semantic queries are more robust)
- Test implementation details (internal state, specific DOM structure)
- Mock React components unnecessarily - test behavior through props/effects
- Create interdependent tests that rely on execution order
- Ignore accessibility attributes when querying elements
- Use `container.querySelector()` - rely on `screen` queries instead
- Install extra testing libraries unnecessarily - jsdom + React Testing Library are sufficient for unit tests

## Development Environment

### Start Services

```bash
# Install dependencies
npm install

# Run tests in watch mode
npm run test:watch

# Run tests once (for CI)
npm run test

# View test UI
npm run test:ui
```

### Service URLs
- Frontend (Dev): http://localhost:3001
- Frontend (Build): npm run build

### Required Environment Variables
All environment variables from `.env` file:
- `NODE_ENV`: development
- `LOG_LEVEL`: info
- `VITE_API_URL`: http://localhost:3001
- `VITE_EXPRESS_URL`: http://localhost:3001/api
- `VITE_STRAPI_URL`: http://localhost:1337/api
- (Refer to project_index.json for complete list)

## Success Criteria

The task is complete when:

1. [ ] vitest.config.ts created with jsdom environment configuration
2. [ ] src/test/setup.ts created with jest-dom matcher imports
3. [ ] package.json updated with all testing dependencies and scripts
4. [ ] Minimum 10-15 component test files created in tests/ directory
5. [ ] All tests pass with `npm run test` (--run flag)
6. [ ] Tests follow React Testing Library semantic query patterns
7. [ ] No TypeScript compilation errors in test files
8. [ ] Test output shows clear pass/fail results with descriptive test names
9. [ ] Any bugs discovered during test creation are documented
10. [ ] Bug-tracking mechanism created or integrated with auto-claude system

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Component Rendering | `tests/components/*.test.ts` | Components render without errors; required props display correctly |
| User Interactions | `tests/components/*.test.ts` | Click handlers, form submissions, input changes trigger expected state updates |
| Async Operations | `tests/components/*.test.ts` | Data fetching, loading states, error handling work correctly with waitFor |
| Accessibility | `tests/components/*.test.ts` | Components have proper ARIA roles, labels, and keyboard navigation |
| Radix UI Integration | `tests/components/*.test.ts` | Radix UI components render with proper accessibility attributes |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Component Tree Integration | Frontend Components | Parent/child component communication works; props flow correctly |
| Context Providers | Frontend Context | Context values accessible to consuming components; state updates propagate |
| API Mocking | Frontend ↔ Backend | Fetch/API calls properly mocked; error states handled |

### End-to-End Tests (Optional - Playwright)
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Agent Creation | 1. Navigate to agents 2. Click create 3. Fill form 4. Submit | New agent appears in list; success message displayed |
| Skill Management | 1. Navigate to skills 2. Create/edit/delete skill 3. Verify UI | Skill operations reflected in UI immediately |

### Browser Verification
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Home Page | `http://localhost:3001` | Page loads; no console errors; layout renders |
| Agent Management | `http://localhost:3001/agents` | Agent list displays; actions (create, edit, delete) available |
| Skill Editor | `http://localhost:3001/skills` | Skill components render; Radix UI elements functional |

### Test Execution Verification
| Check | Command | Expected |
|-------|---------|----------|
| Install dependencies | `npm install` | All packages installed; no peer dependency warnings |
| Run tests | `npm run test` | All tests pass; clear pass/fail output |
| Test watch mode | `npm run test:watch` | Tests re-run on file changes; watch mode exits cleanly |
| Type checking | `npx tsc --noEmit` | No TypeScript errors in test files |

### QA Sign-off Requirements
- [ ] All unit tests pass (100% pass rate)
- [ ] All integration tests pass (if created)
- [ ] All E2E tests pass (if Playwright installed)
- [ ] No console errors when running tests
- [ ] Tests execute in <30 seconds total
- [ ] Test code follows project TypeScript conventions
- [ ] jest-dom matchers properly configured and working
- [ ] React Testing Library patterns consistently applied
- [ ] Accessibility testing validates Radix UI integration
- [ ] Bug discovery process documented and tested
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns from reference files
- [ ] No security vulnerabilities in testing dependencies
- [ ] All discovered bugs logged with reproduction steps
- [ ] Bug-creation workflow in auto-claude tested and working
