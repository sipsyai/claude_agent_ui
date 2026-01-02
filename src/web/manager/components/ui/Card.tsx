/**
 * Card Component System
 *
 * A flexible card component system for creating content containers with consistent styling
 * and structure. The Card is composed of multiple sub-components (CardHeader, CardTitle,
 * CardDescription, CardContent, CardFooter) that work together to create well-organized
 * content sections throughout the application.
 *
 * ## Features
 * - Modular design with composable sub-components
 * - Consistent border, shadow, and background styling
 * - Responsive padding and spacing
 * - Flexbox layouts for header and footer
 * - Theme-aware colors (bg-card, text-card-foreground)
 * - Supports ref forwarding for all components
 * - Extends native HTML attributes for full flexibility
 *
 * ## Component Structure
 * The typical card structure follows this hierarchy:
 * ```
 * Card (container)
 *   ├── CardHeader (optional header section)
 *   │     ├── CardTitle (heading)
 *   │     └── CardDescription (subtitle/description)
 *   ├── CardContent (main content)
 *   └── CardFooter (optional footer with actions)
 * ```
 *
 * ## Styling Behavior
 * - **Card**: Rounded corners, border, shadow-sm, theme-aware background
 * - **CardHeader**: Flexbox column with vertical spacing, top padding
 * - **CardTitle**: Large semibold heading (text-2xl) with tight tracking
 * - **CardDescription**: Small muted text for descriptions
 * - **CardContent**: Padded content area without top padding (assumes header above)
 * - **CardFooter**: Flexbox row for action buttons, aligned items
 *
 * All components accept `className` prop for additional custom styling.
 *
 * @example
 * // Basic card with all sections
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Card description text</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Main content goes here</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 *
 * @example
 * // Simple card with just title and content
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Settings</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <form>
 *       <Input placeholder="Enter value" />
 *     </form>
 *   </CardContent>
 * </Card>
 *
 * @example
 * // Card with footer actions
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Confirm Action</CardTitle>
 *     <CardDescription>This action cannot be undone</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Are you sure you want to continue?</p>
 *   </CardContent>
 *   <CardFooter className="justify-end space-x-2">
 *     <Button variant="secondary">Cancel</Button>
 *     <Button variant="destructive">Delete</Button>
 *   </CardFooter>
 * </Card>
 *
 * @example
 * // Card with custom styling
 * <Card className="max-w-md hover:shadow-lg transition-shadow">
 *   <CardHeader>
 *     <CardTitle>Custom Card</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Card with custom width and hover effect</p>
 *   </CardContent>
 * </Card>
 *
 * @example
 * // Content-only card (no header)
 * <Card>
 *   <CardContent className="pt-6">
 *     <div className="text-center">
 *       <p>Simple content without header</p>
 *     </div>
 *   </CardContent>
 * </Card>
 */

import React from 'react';

/**
 * Card - Main container component
 *
 * The root container for card content with rounded corners, border, and shadow.
 * Acts as the wrapper for all card sub-components.
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Card content (typically CardHeader, CardContent, CardFooter)
 * - All other div attributes (onClick, onMouseEnter, data-*, etc.)
 *
 * ## Styling
 * - `rounded-lg`: Large rounded corners (8px)
 * - `border`: 1px border with theme color
 * - `bg-card`: Theme-aware background color
 * - `text-card-foreground`: Theme-aware text color
 * - `shadow-sm`: Subtle shadow for depth
 *
 * @example
 * <Card className="max-w-lg">
 *   <CardContent>Content here</CardContent>
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className || ''}`}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/**
 * CardHeader - Header section for card title and description
 *
 * A flex container for card header content, typically containing CardTitle
 * and CardDescription components. Uses flexbox column layout with vertical spacing.
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Header content (typically CardTitle and CardDescription)
 * - All other div attributes
 *
 * ## Styling
 * - `flex flex-col`: Vertical flexbox layout
 * - `space-y-1.5`: 6px vertical spacing between children
 * - `p-6`: 24px padding on all sides
 *
 * @example
 * <CardHeader>
 *   <CardTitle>Title</CardTitle>
 *   <CardDescription>Description</CardDescription>
 * </CardHeader>
 *
 * @example
 * // Custom header alignment
 * <CardHeader className="items-center text-center">
 *   <CardTitle>Centered Title</CardTitle>
 * </CardHeader>
 */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className || ''}`} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

/**
 * CardTitle - Main heading for the card
 *
 * A large, semibold heading (h3) component for card titles. Provides prominent
 * typography with tight tracking for a polished look.
 *
 * ## Props
 * Extends all standard HTML heading attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Title text content
 * - All other h3 attributes
 *
 * ## Styling
 * - `text-2xl`: 24px font size
 * - `font-semibold`: 600 font weight
 * - `leading-none`: Tight line height (1)
 * - `tracking-tight`: Slightly reduced letter spacing (-0.025em)
 *
 * @example
 * <CardTitle>User Profile</CardTitle>
 *
 * @example
 * // Custom title styling
 * <CardTitle className="text-primary">
 *   Featured Item
 * </CardTitle>
 */
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={`text-2xl font-semibold leading-none tracking-tight ${className || ''}`} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

/**
 * CardDescription - Subtitle or description text for the card
 *
 * A muted text component for card descriptions, subtitles, or supporting information.
 * Typically placed below CardTitle in the CardHeader.
 *
 * ## Props
 * Extends all standard HTML paragraph attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Description text content
 * - All other p attributes
 *
 * ## Styling
 * - `text-sm`: 14px font size
 * - `text-muted-foreground`: Muted/subtle text color from theme
 *
 * @example
 * <CardDescription>
 *   Additional information about this card
 * </CardDescription>
 *
 * @example
 * // Multi-line description
 * <CardDescription>
 *   This is a longer description that provides
 *   more context about the card content.
 * </CardDescription>
 */
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className || ''}`} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

/**
 * CardContent - Main content area of the card
 *
 * The primary content container for card body content. Uses horizontal padding
 * but no top padding, assuming it follows a CardHeader component.
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Main card content
 * - All other div attributes
 *
 * ## Styling
 * - `p-6`: 24px padding on all sides
 * - `pt-0`: No top padding (assumes header above provides spacing)
 *
 * ## Usage Notes
 * If using CardContent without a CardHeader above it, add `pt-6` to className
 * to restore top padding for proper spacing.
 *
 * @example
 * <CardContent>
 *   <p>Main content goes here</p>
 * </CardContent>
 *
 * @example
 * // Content without header (add top padding)
 * <CardContent className="pt-6">
 *   <div>Standalone content</div>
 * </CardContent>
 *
 * @example
 * // Form content
 * <CardContent>
 *   <form className="space-y-4">
 *     <Input label="Name" />
 *     <Textarea label="Description" />
 *   </form>
 * </CardContent>
 */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 ${className || ''}`} {...props} />
  )
);
CardContent.displayName = 'CardContent';

/**
 * CardFooter - Footer section for actions and buttons
 *
 * A flex container for card footer content, typically containing action buttons
 * or additional controls. Uses flexbox row layout with centered items.
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Footer content (typically buttons or links)
 * - All other div attributes
 *
 * ## Styling
 * - `flex`: Flexbox layout
 * - `items-center`: Vertically center items
 * - `p-6`: 24px padding on all sides
 * - `pt-0`: No top padding (assumes content above provides spacing)
 *
 * ## Common Patterns
 * - Add `justify-end` to right-align buttons
 * - Add `justify-between` to space buttons apart
 * - Add `space-x-2` or `gap-2` for button spacing
 *
 * @example
 * // Right-aligned action buttons
 * <CardFooter className="justify-end space-x-2">
 *   <Button variant="secondary">Cancel</Button>
 *   <Button>Save</Button>
 * </CardFooter>
 *
 * @example
 * // Space between left and right content
 * <CardFooter className="justify-between">
 *   <span className="text-sm text-muted-foreground">
 *     Last updated: 2 hours ago
 *   </span>
 *   <Button>Edit</Button>
 * </CardFooter>
 *
 * @example
 * // Centered single button
 * <CardFooter className="justify-center">
 *   <Button>Learn More</Button>
 * </CardFooter>
 */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`flex items-center p-6 pt-0 ${className || ''}`} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
   