/**
 * Layout Component
 *
 * The main application layout component that provides a consistent structure with a sidebar
 * navigation and main content area. This component serves as the primary layout wrapper for
 * all manager UI pages, ensuring a cohesive user experience with fixed navigation and
 * scrollable content.
 *
 * ## Features
 * - Fixed sidebar navigation on the left side (64-width, 256px)
 * - Flexible main content area that fills remaining horizontal space
 * - Full-height layout (100vh) with proper overflow handling
 * - Optional container wrapper for content with responsive padding
 * - Theme-aware background and text colors
 * - Sidebar integration with navigation state management
 * - Responsive padding that adapts to screen sizes (sm, lg breakpoints)
 *
 * ## Layout Structure
 * The component uses a horizontal flexbox layout:
 * ```
 * Layout (flex container, full height)
 *   ├── Sidebar (fixed width: 256px)
 *   └── Main (flex-1, fills remaining space)
 *         └── Container (optional, responsive padding)
 *               └── Children (page content)
 * ```
 *
 * ## Children Rendering
 * The component renders children in one of two modes:
 *
 * **Container Mode (default)**: Children are wrapped in a responsive container with:
 * - Auto horizontal margins for centering
 * - Responsive padding: px-4 (mobile), px-6 (sm+), px-8 (lg+)
 * - Vertical padding: py-8 (32px)
 * - Vertical scrolling with overflow-y-auto
 * - Flex-1 to fill available vertical space
 *
 * **No Container Mode (noContainer=true)**: Children are rendered directly without wrapper:
 * - Useful for full-width content (dashboards, flow designers)
 * - Page controls its own padding and scrolling
 * - Maximum flexibility for custom layouts
 *
 * ## Sidebar Integration
 * The Layout component integrates the Sidebar component by:
 * - Spreading all `sidebarProps` to the Sidebar component
 * - Managing active view state through `activeView` prop
 * - Handling navigation through `onNavigate` callback
 * - Optional directory display with `directoryName` and `onChangeDirectory`
 *
 * The sidebar is always visible and provides primary navigation for the application.
 * See the Sidebar component documentation for details on navigation items and behavior.
 *
 * ## Responsive Behavior
 * - **Fixed height**: Layout is always 100vh (full viewport height)
 * - **Overflow handling**: Root has `overflow-hidden`, main area controls scrolling
 * - **Responsive padding**: Container padding increases on larger screens
 *   - Mobile: px-4 (16px horizontal)
 *   - Small (640px+): px-6 (24px horizontal)
 *   - Large (1024px+): px-8 (32px horizontal)
 * - **Sidebar width**: Fixed at 256px (w-64) on all screen sizes
 *
 * ## Styling Behavior
 * The Layout uses Tailwind CSS with:
 * - **Root container**: Full height flex row, theme background/foreground colors
 * - **Overflow control**: Root prevents overflow, main area manages content scrolling
 * - **Theme colors**: `bg-background` and `text-foreground` for theme consistency
 * - **Responsive classes**: sm: and lg: breakpoint modifiers for padding
 *
 * @example
 * // Basic layout with container (most common)
 * <Layout sidebarProps={{ activeView: ManagerView.Dashboard, onNavigate: handleNavigate }}>
 *   <h1>Dashboard</h1>
 *   <div>Content with automatic responsive padding and scrolling</div>
 * </Layout>
 *
 * @example
 * // Layout with directory selector in sidebar
 * <Layout
 *   sidebarProps={{
 *     activeView: ManagerView.Agents,
 *     onNavigate: handleNavigate,
 *     directoryName: "/projects/my-app",
 *     onChangeDirectory: () => setShowDirectoryPicker(true)
 *   }}
 * >
 *   <AgentsPage />
 * </Layout>
 *
 * @example
 * // Full-width layout without container wrapper
 * <Layout
 *   sidebarProps={{ activeView: ManagerView.Chat, onNavigate: handleNavigate }}
 *   noContainer={true}
 * >
 *   <ChatPage />
 * </Layout>
 *
 * @example
 * // Layout for flow designer (full-width, custom overflow)
 * <Layout
 *   sidebarProps={{ activeView: ManagerView.FlowDesigner, onNavigate: handleNavigate }}
 *   noContainer={true}
 * >
 *   <FlowDesigner className="h-full" />
 * </Layout>
 */

import React from 'react';
import Sidebar, { SidebarProps } from './Sidebar';

/**
 * Props for the Layout component
 */
interface LayoutProps {
  /**
   * The page content to render in the main area
   *
   * Can be any valid React node including components, elements, or fragments.
   * Will be wrapped in a responsive container unless noContainer is true.
   */
  children: React.ReactNode;

  /**
   * Props to pass to the Sidebar component
   *
   * Controls sidebar navigation state and behavior:
   * - `activeView`: Currently active navigation item (highlighted)
   * - `onNavigate`: Callback when user clicks navigation items
   * - `directoryName`: Optional current working directory display
   * - `onChangeDirectory`: Optional callback for directory selection
   *
   * See SidebarProps interface for complete prop definitions.
   */
  sidebarProps: SidebarProps;

  /**
   * Whether to skip the container wrapper and render children directly
   *
   * **When false (default)**:
   * - Children wrapped in responsive container with padding
   * - Centered content with max-width constraints
   * - Automatic vertical scrolling
   * - Standard padding: px-4 (mobile), px-6 (sm+), px-8 (lg+), py-8 (vertical)
   *
   * **When true**:
   * - Children rendered directly in main element
   * - No automatic padding or max-width
   * - Page controls its own layout and scrolling
   * - Useful for full-width layouts (dashboards, editors, chat interfaces)
   *
   * @default false
   */
  noContainer?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, sidebarProps, noContainer = false }) => {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar {...sidebarProps} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {noContainer ? (
          children
        ) : (
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 overflow-y-auto flex-1">
            {children}
          </div>
        )}
      </main>
    </div>
  );
};

Layout.displayName = 'Layout';

export default Layout;
