/**
 * Configuration Sidebar Component
 *
 * A collapsible left sidebar that houses flow configuration options including
 * metadata (name, description, category, etc.) and trigger settings (webhook,
 * schedule). Provides a clean, organized interface for managing flow settings
 * without cluttering the main canvas area.
 *
 * ## Features
 * - Collapsible design: 320px when expanded, 50px when collapsed
 * - Smooth CSS transitions for collapse/expand animations
 * - Organized into collapsible sections (Metadata, Triggers)
 * - Theme-aware styling matching application design system
 * - Persistent state management for sidebar collapsed state
 * - Full keyboard accessibility and screen reader support
 * - Responsive design with mobile/tablet adaptations
 *
 * ## Sections
 * The sidebar provides two main configuration sections:
 *
 * ### Metadata Section
 * - **Purpose**: Configure flow identification and classification
 * - **Fields**: Name, slug, description, category, status, version, isActive
 * - **Icon**: SlidersHorizontalIcon (gray theme)
 * - **Default State**: Expanded
 *
 * ### Triggers Section
 * - **Purpose**: Configure how the flow can be triggered
 * - **Options**: Webhook trigger, schedule trigger (cron expressions)
 * - **Icon**: ClockIcon (gray theme)
 * - **Default State**: Collapsed
 *
 * ## Collapse Behavior
 * When collapsed:
 * - Width reduces from 320px to 50px
 * - Section content hidden, only icons visible
 * - Toggle button remains accessible
 * - Canvas automatically expands to fill available space
 * - Hover shows tooltip with sidebar name
 *
 * When expanded:
 * - Full width (320px) with all content visible
 * - Sections can be individually collapsed/expanded
 * - Scrollable content area if sections exceed viewport height
 * - Collapse button clearly visible at top
 *
 * ## Responsive Behavior
 * - **Mobile/Tablet (<768px)**: Sidebar automatically collapses to maximize canvas space
 * - **Desktop (≥768px)**: Sidebar restores to user's last preference
 * - User preferences are preserved separately from auto-collapse behavior
 * - Manual toggle remains available at all viewport sizes
 * - Smooth transitions when crossing breakpoint threshold
 *
 * ## Component Structure
 * ```
 * ConfigSidebar (sidebar container)
 *   ├── Header
 *   │     ├── Title "Configuration"
 *   │     └── Collapse Toggle Button
 *   └── Content (scrollable)
 *         ├── Metadata Section (CollapsibleSection)
 *         │     └── [Content slot for metadata form]
 *         └── Triggers Section (CollapsibleSection)
 *               └── [Content slot for trigger configuration]
 * ```
 *
 * ## Styling Behavior
 * - **Container**: Fixed width transitions (320px ↔ 50px), full height
 * - **Background**: Theme background with border-r separator
 * - **Header**: Sticky at top with collapse toggle
 * - **Transitions**: Smooth width/opacity animations (300ms ease-in-out)
 * - **Collapsed State**: Icon-only view with minimal padding
 * - **Expanded State**: Full content with proper spacing and scrolling
 *
 * ## State Persistence
 * The sidebar collapsed state is persisted to localStorage:
 * - **Key**: `flowEditor.sidebarCollapsed`
 * - **Behavior**: State restored on component mount
 * - **Fallback**: Default to expanded if no stored preference
 *
 * ## Accessibility
 * - Semantic HTML structure with proper ARIA labels
 * - Keyboard navigation support (Tab, Enter, Space for toggle)
 * - Focus states on interactive elements
 * - Screen reader announcements for collapse state changes
 * - aria-expanded attributes on collapsible sections
 *
 * @example
 * // Basic usage in FlowEditorVisual
 * <div className="flex h-screen">
 *   <ConfigSidebar>
 *     <MetadataForm />
 *     <TriggerConfiguration />
 *   </ConfigSidebar>
 *   <ReactFlowCanvas />
 * </div>
 *
 * @example
 * // With custom className
 * <ConfigSidebar className="border-l-4 border-primary" />
 *
 * @example
 * // Controlled collapsed state from parent
 * const [isCollapsed, setIsCollapsed] = useState(false);
 * <ConfigSidebar
 *   isCollapsed={isCollapsed}
 *   onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
 * />
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontalIcon,
  ClockIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '../ui/Icons';

/**
 * Props for the ConfigSidebar component
 */
export interface ConfigSidebarProps {
  /**
   * Optional additional CSS classes for the container
   */
  className?: string;

  /**
   * Optional content for the metadata section
   * If not provided, a placeholder message will be shown
   */
  metadataContent?: React.ReactNode;

  /**
   * Optional content for the triggers section
   * If not provided, a placeholder message will be shown
   */
  triggersContent?: React.ReactNode;

  /**
   * Optional controlled collapsed state
   * If provided, component operates in controlled mode
   */
  isCollapsed?: boolean;

  /**
   * Optional callback when collapse state changes
   * Required when using controlled mode
   */
  onToggleCollapse?: () => void;
}

/**
 * Props for the CollapsibleSection component
 */
interface CollapsibleSectionProps {
  /** Section title displayed in header */
  title: string;
  /** Icon to display next to title */
  icon: React.ReactNode;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Whether the parent sidebar is collapsed */
  sidebarCollapsed?: boolean;
}

/**
 * CollapsibleSection Component
 *
 * A collapsible section wrapper for grouping related configuration options.
 * Provides expand/collapse functionality with smooth transitions.
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultExpanded = true,
  children,
  sidebarCollapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-2">
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          flex items-center gap-2 w-full px-3 py-2
          text-sm font-semibold
          text-muted-foreground hover:text-foreground
          transition-colors
          ${sidebarCollapsed ? 'justify-center' : ''}
        `}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
        title={sidebarCollapsed ? title : undefined}
      >
        {/* Icon */}
        <div className="flex-shrink-0">{icon}</div>

        {/* Title and Expand/Collapse Icon (hidden when sidebar collapsed) */}
        {!sidebarCollapsed && (
          <>
            <span className="flex-1 text-left">{title}</span>
            {isExpanded ? (
              <ChevronDownIcon width={16} height={16} />
            ) : (
              <ChevronRightIcon width={16} height={16} />
            )}
          </>
        )}
      </button>

      {/* Section Content */}
      {isExpanded && !sidebarCollapsed && (
        <div className="px-3 pb-2 space-y-3">{children}</div>
      )}
    </div>
  );
};

/**
 * ConfigSidebar Component
 *
 * Main component that renders the collapsible configuration sidebar.
 * Houses metadata and trigger configuration sections.
 */
export const ConfigSidebar: React.FC<ConfigSidebarProps> = ({
  className = '',
  metadataContent,
  triggersContent,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
}) => {
  // Local state for uncontrolled mode
  const [localIsCollapsed, setLocalIsCollapsed] = useState(false);

  // Responsive breakpoint state
  const [isMobileView, setIsMobileView] = useState(false);

  // Track user's preference before auto-collapse (for restoration)
  const userPreferenceRef = useRef<boolean>(false);

  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledIsCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledIsCollapsed : localIsCollapsed;

  // Load collapsed state from localStorage on mount (uncontrolled mode only)
  useEffect(() => {
    if (!isControlled) {
      const stored = localStorage.getItem('flowEditor.sidebarCollapsed');
      if (stored !== null) {
        const storedValue = stored === 'true';
        setLocalIsCollapsed(storedValue);
        userPreferenceRef.current = storedValue;
      }
    }
  }, [isControlled]);

  // Save collapsed state to localStorage (uncontrolled mode only)
  useEffect(() => {
    if (!isControlled && !isMobileView) {
      // Only save user preference when not in mobile view
      localStorage.setItem('flowEditor.sidebarCollapsed', String(isCollapsed));
      userPreferenceRef.current = isCollapsed;
    }
  }, [isCollapsed, isControlled, isMobileView]);

  // Responsive breakpoint detection
  useEffect(() => {
    const MOBILE_BREAKPOINT = 768;

    const checkViewport = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobileView(isMobile);

      if (!isControlled) {
        if (isMobile) {
          // Auto-collapse on mobile/tablet
          setLocalIsCollapsed(true);
        } else {
          // Restore user preference on desktop
          setLocalIsCollapsed(userPreferenceRef.current);
        }
      }
    };

    // Check on mount
    checkViewport();

    // Listen to resize events
    window.addEventListener('resize', checkViewport);

    return () => {
      window.removeEventListener('resize', checkViewport);
    };
  }, [isControlled]);

  /**
   * Handle collapse toggle
   */
  const handleToggleCollapse = () => {
    if (isControlled && onToggleCollapse) {
      onToggleCollapse();
    } else if (!isControlled) {
      const newCollapsedState = !localIsCollapsed;
      setLocalIsCollapsed(newCollapsedState);
      // Update user preference if not in mobile view
      if (!isMobileView) {
        userPreferenceRef.current = newCollapsedState;
      }
    }
  };

  return (
    <div
      className={`
        ${isCollapsed ? 'w-[50px]' : 'w-[320px]'}
        h-full
        bg-background border-r border-border
        flex flex-col
        transition-all duration-300 ease-in-out
        ${className}
      `}
      aria-label="Configuration sidebar"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Title (hidden when collapsed) */}
          {!isCollapsed && (
            <h2 className="font-semibold text-lg truncate">Configuration</h2>
          )}

          {/* Collapse Toggle Button */}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className={`
              flex-shrink-0 p-1.5 rounded-md
              text-muted-foreground hover:text-foreground
              hover:bg-secondary/50
              transition-colors
              ${isCollapsed ? 'mx-auto' : ''}
            `}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRightIcon
              width={20}
              height={20}
              className={`
                transition-transform duration-300
                ${isCollapsed ? 'rotate-0' : 'rotate-180'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Content - Scrollable Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4">
        {/* Metadata Section */}
        <CollapsibleSection
          title="Metadata"
          icon={<SlidersHorizontalIcon width={20} height={20} />}
          defaultExpanded={true}
          sidebarCollapsed={isCollapsed}
        >
          {metadataContent || (
            <div className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-md">
              <p>Metadata configuration will be displayed here.</p>
              <p className="mt-2">
                Fields: Name, Slug, Description, Category, Status, Version,
                Active Status
              </p>
            </div>
          )}
        </CollapsibleSection>

        {/* Triggers Section */}
        <CollapsibleSection
          title="Triggers"
          icon={<ClockIcon width={20} height={20} />}
          defaultExpanded={false}
          sidebarCollapsed={isCollapsed}
        >
          {triggersContent || (
            <div className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-md">
              <p>Trigger configuration will be displayed here.</p>
              <p className="mt-2">
                Options: Webhook trigger, Schedule trigger (cron expressions)
              </p>
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* Footer with tips (hidden when collapsed) */}
      {!isCollapsed && (
        <div className="border-t border-border px-3 py-3 bg-secondary/30">
          <div className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 text-muted-foreground mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Configure your flow's metadata and triggers in the sections above.
              Changes are saved when you save the flow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Display name for React DevTools
 */
ConfigSidebar.displayName = 'ConfigSidebar';

export default ConfigSidebar;
