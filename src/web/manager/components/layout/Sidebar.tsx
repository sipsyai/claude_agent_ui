/**
 * Sidebar Component
 *
 * The primary navigation sidebar for the Claude Manager application. Provides a fixed-width
 * left-side navigation panel with application branding, menu items for different views,
 * active state highlighting, and optional directory selection. This component serves as the
 * main navigation mechanism for all major application sections.
 *
 * ## Features
 * - Fixed width sidebar (256px / w-64) with theme-aware styling
 * - Application branding with logo and title
 * - 8 primary navigation menu items with icons and labels
 * - Visual active state highlighting for current view
 * - Smooth hover transitions on menu items
 * - Optional directory selector at bottom (sticky footer)
 * - Theme-consistent colors and borders
 * - Full keyboard navigation support
 *
 * ## Navigation Items
 * The sidebar displays the following navigation items in order:
 * 1. **Dashboard** (LayoutGridIcon) - Main overview and metrics
 * 2. **Chat** (MessageSquareIcon) - Chat interface for agent interaction
 * 3. **Agents** (CpuChipIcon) - Agent management and configuration
 * 4. **Commands** (CommandLineIcon) - Command execution and history
 * 5. **Skills** (PuzzlePieceIcon) - Skill creation and management
 * 6. **MCP Servers** (ServerIcon) - MCP server configuration
 * 7. **Tasks** (ClipboardListIcon) - Task execution and monitoring
 * 8. **Settings** (SlidersHorizontalIcon) - Application settings
 *
 * Each item includes:
 * - Icon component (5x5, from Icons.tsx)
 * - Text label
 * - Click handler for navigation
 * - Visual feedback for active/inactive states
 *
 * ## Active State
 * The active navigation item is highlighted with:
 * - **Background**: `bg-primary/10` (10% opacity primary color)
 * - **Text color**: `text-primary` (full primary color)
 * - **Visual distinction**: Clearly stands out from inactive items
 *
 * Inactive items use:
 * - **Background**: Transparent (hover: `bg-secondary`)
 * - **Text color**: `text-muted-foreground` (hover: `text-foreground`)
 * - **Hover effect**: Background changes to secondary color with smooth transition
 *
 * ## Directory Selector (Optional)
 * When `directoryName` and `onChangeDirectory` props are provided:
 * - Displays at bottom of sidebar (mt-auto pushes to bottom)
 * - Shows current working directory path with folder icon
 * - Truncates long paths with ellipsis and shows full path on hover
 * - "Change Directory" button to trigger directory picker
 * - Styled with secondary background for visual separation
 * - Compact layout (p-3) with responsive button (w-full, size="sm")
 *
 * If either prop is missing, directory selector is not rendered.
 *
 * ## Layout Structure
 * The sidebar uses a vertical flex layout:
 * ```
 * Sidebar (flex column, w-64)
 *   ├── Header (mb-8)
 *   │     ├── Logo (h-8 w-8)
 *   │     └── Title "Claude Manager"
 *   ├── Navigation (flex-1, fills available space)
 *   │     └── Menu Items (list)
 *   └── Directory Selector (mt-auto, optional)
 *         ├── Current Directory (folder icon + path)
 *         └── Change Directory Button
 * ```
 *
 * ## Styling Behavior
 * The Sidebar uses Tailwind CSS with:
 * - **Container**: Fixed width (w-64 = 256px), full height, padding p-4
 * - **Background**: Theme background color with right border
 * - **Flex layout**: Column direction with nav taking flex-1
 * - **Menu items**: Full-width buttons with gap-3 between icon and text
 * - **Transitions**: Smooth color transitions on hover (transition-colors)
 * - **Theme colors**:
 *   - Border: `border-border`
 *   - Active: `bg-primary/10`, `text-primary`
 *   - Inactive: `text-muted-foreground`
 *   - Hover: `bg-secondary`, `text-foreground`
 *
 * @example
 * // Basic sidebar with active view highlighting
 * <Sidebar
 *   activeView={ManagerView.Dashboard}
 *   onNavigate={(view) => setCurrentView(view)}
 * />
 *
 * @example
 * // Sidebar with directory selector
 * <Sidebar
 *   activeView={ManagerView.Agents}
 *   onNavigate={handleNavigate}
 *   directoryName="/projects/my-app"
 *   onChangeDirectory={() => setShowDirectoryPicker(true)}
 * />
 *
 * @example
 * // Sidebar integrated in Layout component
 * <Layout
 *   sidebarProps={{
 *     activeView: currentView,
 *     onNavigate: (view) => {
 *       setCurrentView(view);
 *       // Additional navigation logic (routing, state updates, etc.)
 *     }
 *   }}
 * >
 *   <PageContent />
 * </Layout>
 *
 * @example
 * // Sidebar with directory tracking and navigation
 * const [currentView, setCurrentView] = useState(ManagerView.Dashboard);
 * const [directory, setDirectory] = useState('/home/user/project');
 *
 * <Sidebar
 *   activeView={currentView}
 *   onNavigate={setCurrentView}
 *   directoryName={directory}
 *   onChangeDirectory={async () => {
 *     const newDir = await selectDirectory();
 *     if (newDir) setDirectory(newDir);
 *   }}
 * />
 */

import React from 'react';
import { ManagerView } from '../../types';

import {
  LayoutGridIcon,
  CommandLineIcon,
  PuzzlePieceIcon,
  ClipboardListIcon,
  SlidersHorizontalIcon,
  CpuChipIcon,
  ServerIcon,
  FolderIcon,
  MessageSquareIcon,
  PlayCircleIcon,
} from '../ui/Icons';
import { Button } from '../ui/Button';

/**
 * Props for the Sidebar component
 */
export interface SidebarProps {
  /**
   * The currently active view in the application
   *
   * Determines which navigation item is highlighted. Must be one of the ManagerView
   * enum values. The corresponding menu item will be styled with primary colors to
   * indicate it's the current view.
   *
   * Available views: Dashboard, Chat, Agents, Commands, Skills, MCPServers, Tasks, Settings
   */
  activeView: ManagerView;

  /**
   * Callback function when a navigation item is clicked
   *
   * Called with the ManagerView enum value of the clicked item. The parent component
   * should handle this callback to:
   * - Update the activeView state
   * - Navigate to the corresponding page/route
   * - Perform any necessary cleanup or state transitions
   * - Update URL or history if using routing
   *
   * @param view - The ManagerView that was clicked
   *
   * @example
   * onNavigate={(view) => {
   *   setCurrentView(view);
   *   router.push(`/${view.toLowerCase()}`);
   * }}
   */
  onNavigate: (view: ManagerView) => void;

  /**
   * Optional name/path of the current working directory
   *
   * When provided (along with onChangeDirectory), displays a directory selector
   * at the bottom of the sidebar showing the current working directory path.
   * The path is truncated with ellipsis if too long, with full path shown on hover.
   *
   * If undefined or empty, shows "No directory selected" placeholder text.
   * If this prop or onChangeDirectory is not provided, directory selector is hidden.
   *
   * @example
   * directoryName="/home/user/projects/my-app"
   * directoryName="/Users/john/Documents/workspace"
   */
  directoryName?: string;

  /**
   * Optional callback when the "Change Directory" button is clicked
   *
   * Called when user wants to select a new working directory. The parent component
   * should handle this by:
   * - Opening a directory picker dialog
   * - Updating the directoryName state with the selected path
   * - Performing any necessary file system operations or validations
   *
   * If not provided (or directoryName is not provided), directory selector is hidden.
   *
   * @example
   * onChangeDirectory={async () => {
   *   const newDir = await window.electron.selectDirectory();
   *   if (newDir) setDirectory(newDir);
   * }}
   */
  onChangeDirectory?: () => void;
}

const menuItems = [
  { view: ManagerView.Dashboard, label: 'Dashboard', icon: LayoutGridIcon },
  { view: ManagerView.Chat, label: 'Chat', icon: MessageSquareIcon },
  { view: ManagerView.Agents, label: 'Agents', icon: CpuChipIcon },
  { view: ManagerView.Commands, label: 'Commands', icon: CommandLineIcon },
  { view: ManagerView.Skills, label: 'Skills', icon: PuzzlePieceIcon },
  { view: ManagerView.Flows, label: 'Flows', icon: PlayCircleIcon },
  { view: ManagerView.MCPServers, label: 'MCP Servers', icon: ServerIcon },
  { view: ManagerView.Tasks, label: 'Tasks', icon: ClipboardListIcon },
  { view: ManagerView.Settings, label: 'Settings', icon: SlidersHorizontalIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, directoryName, onChangeDirectory }) => {
  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col p-4">
      <div className="flex items-center gap-2 mb-8">
        <img src="/vite.svg" alt="Claude Icon" className="h-8 w-8" />
        <h1 className="text-xl font-bold">Claude Manager</h1>
      </div>
      <nav className="flex-1">
        <ul>
          {menuItems.map((item) => {
            const isActive = activeView === item.view;
            return (
              <li key={item.view}>
                <button
                  onClick={() => onNavigate(item.view)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {directoryName && onChangeDirectory && (
        <div className="mt-auto">
          <div className="p-3 rounded-lg bg-secondary">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <FolderIcon className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium truncate" title={directoryName}>
                {directoryName || 'No directory selected'}
              </span>
            </div>
            <Button variant="secondary" size="sm" className="w-full" onClick={onChangeDirectory}>
              Change Directory
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
};

Sidebar.displayName = 'Sidebar';

export default Sidebar;
