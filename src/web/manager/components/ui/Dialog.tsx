/**
 * Dialog Component System
 *
 * A modal dialog component system for creating overlay windows and popups with consistent
 * styling and behavior. The Dialog is composed of multiple sub-components (DialogContent,
 * DialogHeader, DialogTitle, DialogDescription, DialogFooter) that work together to create
 * well-structured modal interfaces throughout the application.
 *
 * ## Features
 * - Modal overlay with semi-transparent backdrop
 * - Click-outside-to-close functionality
 * - Controlled open/close state management
 * - Smooth fade and scale animations
 * - Responsive layout (center-aligned on small screens, left-aligned on larger screens)
 * - Proper z-index layering (z-50)
 * - Event bubbling control to prevent backdrop clicks from affecting content
 * - Supports ref forwarding for dialog content
 * - Extends native HTML attributes for full flexibility
 *
 * ## Component Structure
 * The typical dialog structure follows this hierarchy:
 * ```
 * Dialog (overlay backdrop)
 *   └── DialogContent (modal container)
 *         ├── DialogHeader (optional header section)
 *         │     ├── DialogTitle (heading)
 *         │     └── DialogDescription (subtitle/description)
 *         ├── [Main content]
 *         └── DialogFooter (optional footer with actions)
 * ```
 *
 * ## Styling Behavior
 * - **Dialog**: Full-screen overlay backdrop with semi-transparent black background
 * - **DialogContent**: Centered modal window with rounded corners, border, shadow, and animations
 * - **DialogHeader**: Flexbox column layout with text alignment (center on mobile, left on desktop)
 * - **DialogTitle**: Large semibold heading (text-lg) for modal title
 * - **DialogDescription**: Small muted text for descriptions
 * - **DialogFooter**: Responsive flexbox layout (column-reverse on mobile, row on desktop)
 *
 * All components accept `className` prop for additional custom styling.
 *
 * @example
 * // Basic dialog with all sections
 * const [open, setOpen] = useState(false);
 *
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Confirm Action</DialogTitle>
 *       <DialogDescription>
 *         Are you sure you want to proceed with this action?
 *       </DialogDescription>
 *     </DialogHeader>
 *     <div className="py-4">
 *       <p>This action cannot be undone.</p>
 *     </div>
 *     <DialogFooter>
 *       <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button variant="destructive" onClick={handleConfirm}>Delete</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 *
 * @example
 * // Simple dialog with just title and content
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Notification</DialogTitle>
 *     </DialogHeader>
 *     <p className="py-4">Your changes have been saved successfully.</p>
 *   </DialogContent>
 * </Dialog>
 *
 * @example
 * // Form dialog with input fields
 * <Dialog open={showForm} onOpenChange={setShowForm}>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Create New Item</DialogTitle>
 *       <DialogDescription>
 *         Enter the details for your new item below.
 *       </DialogDescription>
 *     </DialogHeader>
 *     <form className="space-y-4 py-4">
 *       <Input placeholder="Item name" />
 *       <Textarea placeholder="Description" />
 *     </form>
 *     <DialogFooter>
 *       <Button variant="secondary" onClick={() => setShowForm(false)}>
 *         Cancel
 *       </Button>
 *       <Button onClick={handleSubmit}>Create</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 *
 * @example
 * // Dialog with custom content styling
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent className="max-w-3xl">
 *     <DialogHeader>
 *       <DialogTitle>Large Dialog</DialogTitle>
 *     </DialogHeader>
 *     <div className="grid grid-cols-2 gap-4 py-4">
 *       <div>Column 1</div>
 *       <div>Column 2</div>
 *     </div>
 *   </DialogContent>
 * </Dialog>
 */

import React from 'react';

/**
 * Props for the Dialog component
 *
 * @property {boolean} open - Controls whether the dialog is visible
 * @property {function} onOpenChange - Callback invoked when the dialog should open/close (e.g., clicking backdrop)
 * @property {React.ReactNode} children - Dialog content (typically DialogContent component)
 */
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Dialog - Main modal overlay component
 *
 * The root component that creates a full-screen overlay backdrop. Manages the visibility
 * state and handles click-outside-to-close behavior. When open, renders a semi-transparent
 * black backdrop with centered content.
 *
 * ## Props
 * - `open`: Boolean controlling dialog visibility
 * - `onOpenChange`: Callback function invoked with `false` when backdrop is clicked
 * - `children`: Dialog content (should contain DialogContent component)
 *
 * ## Behavior
 * - Renders nothing when `open` is false
 * - Creates a full-screen overlay when `open` is true
 * - Clicking the backdrop calls `onOpenChange(false)` to close the dialog
 * - Fades in with `animate-fade-in-fast` animation
 * - Uses z-50 to appear above other content
 *
 * ## Styling
 * - `fixed inset-0`: Full viewport coverage
 * - `bg-black/80`: Semi-transparent black backdrop (80% opacity)
 * - `flex items-center justify-center`: Centers dialog content
 * - `z-50`: High z-index for overlay stacking
 * - `animate-fade-in-fast`: Quick fade-in animation
 *
 * @example
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogContent>
 *     <p>Dialog content</p>
 *   </DialogContent>
 * </Dialog>
 */
const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center animate-fade-in-fast"
      onClick={() => onOpenChange(false)}
    >
      {children}
    </div>
  );
};
Dialog.displayName = 'Dialog';

/**
 * DialogContent - Modal content container
 *
 * The main container for dialog content with rounded corners, border, shadow, and animations.
 * Positioned within the Dialog backdrop and prevents click events from bubbling to the backdrop
 * (preventing accidental closure when clicking inside the dialog).
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Dialog content (typically DialogHeader, main content, DialogFooter)
 * - All other div attributes (data-*, aria-*, etc.)
 *
 * ## Styling
 * - `relative z-50`: Positioned above backdrop
 * - `grid`: Grid layout for content sections
 * - `w-full max-w-lg`: Full width up to large breakpoint (512px)
 * - `gap-4`: 16px spacing between grid items
 * - `border`: 1px border with theme color
 * - `bg-background`: Theme-aware background color
 * - `p-6`: 24px padding on all sides
 * - `shadow-lg`: Large shadow for depth
 * - `rounded-lg`: Large rounded corners (8px)
 * - `animate-scale-in`: Scale and fade-in animation
 * - `duration-200`: 200ms transition duration
 *
 * ## Behavior
 * - Stops event propagation to prevent backdrop clicks when clicking inside dialog
 * - Scales in smoothly when dialog opens
 *
 * @example
 * <DialogContent>
 *   <DialogHeader>
 *     <DialogTitle>Title</DialogTitle>
 *   </DialogHeader>
 *   <p>Content here</p>
 * </DialogContent>
 *
 * @example
 * // Wider dialog content
 * <DialogContent className="max-w-3xl">
 *   <DialogHeader>
 *     <DialogTitle>Wide Dialog</DialogTitle>
 *   </DialogHeader>
 *   <div className="grid grid-cols-2 gap-4">
 *     <div>Left column</div>
 *     <div>Right column</div>
 *   </div>
 * </DialogContent>
 */
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={`relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 rounded-lg animate-scale-in ${className}`}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = 'DialogContent';

/**
 * DialogHeader - Header section for dialog title and description
 *
 * A flex container for dialog header content, typically containing DialogTitle
 * and DialogDescription components. Uses flexbox column layout with vertical spacing.
 * Responsive text alignment: centered on mobile, left-aligned on larger screens.
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Header content (typically DialogTitle and DialogDescription)
 * - All other div attributes
 *
 * ## Styling
 * - `flex flex-col`: Vertical flexbox layout
 * - `space-y-1.5`: 6px vertical spacing between children
 * - `text-center`: Centered text on mobile
 * - `sm:text-left`: Left-aligned text on screens ≥640px
 *
 * @example
 * <DialogHeader>
 *   <DialogTitle>Confirm Delete</DialogTitle>
 *   <DialogDescription>This action cannot be undone</DialogDescription>
 * </DialogHeader>
 *
 * @example
 * // Custom header with centered text on all screens
 * <DialogHeader className="sm:text-center">
 *   <DialogTitle>Welcome</DialogTitle>
 * </DialogHeader>
 */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

/**
 * DialogFooter - Footer section for actions and buttons
 *
 * A flex container for dialog footer content, typically containing action buttons.
 * Uses responsive flexbox layout: column-reverse on mobile (buttons stack with primary
 * on top), row layout on larger screens with right-aligned buttons.
 *
 * ## Props
 * Extends all standard HTML div attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Footer content (typically buttons)
 * - All other div attributes
 *
 * ## Styling
 * - `flex`: Flexbox layout
 * - `flex-col-reverse`: Vertical layout with reversed order on mobile (primary button on top)
 * - `sm:flex-row`: Horizontal layout on screens ≥640px
 * - `sm:justify-end`: Right-align buttons on larger screens
 * - `sm:space-x-2`: 8px horizontal spacing between buttons on larger screens
 *
 * ## Common Patterns
 * - Mobile: Buttons stack vertically with primary action on top
 * - Desktop: Buttons align horizontally at the right
 * - Add `justify-between` to spread buttons apart
 * - Add additional `gap-2` or `space-y-2` for consistent mobile spacing
 *
 * @example
 * // Standard footer with Cancel and Confirm
 * <DialogFooter>
 *   <Button variant="secondary" onClick={onCancel}>Cancel</Button>
 *   <Button onClick={onConfirm}>Confirm</Button>
 * </DialogFooter>
 *
 * @example
 * // Footer with single action button
 * <DialogFooter>
 *   <Button onClick={onClose}>Close</Button>
 * </DialogFooter>
 *
 * @example
 * // Footer with space-between layout
 * <DialogFooter className="sm:justify-between">
 *   <Button variant="secondary">Back</Button>
 *   <div className="space-x-2">
 *     <Button variant="secondary">Cancel</Button>
 *     <Button>Next</Button>
 *   </div>
 * </DialogFooter>
 */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

/**
 * DialogTitle - Main heading for the dialog
 *
 * A large, semibold heading (h2) component for dialog titles. Provides prominent
 * typography with tight tracking for a polished look.
 *
 * ## Props
 * Extends all standard HTML heading attributes:
 * - `className`: Additional CSS classes for custom styling
 * - `children`: Title text content
 * - All other h2 attributes
 *
 * ## Styling
 * - `text-lg`: 18px font size
 * - `font-semibold`: 600 font weight
 * - `leading-none`: Tight line height (1)
 * - `tracking-tight`: Slightly reduced letter spacing (-0.025em)
 *
 * @example
 * <DialogTitle>Delete Confirmation</DialogTitle>
 *
 * @example
 * // Custom title styling
 * <DialogTitle className="text-destructive">
 *   Warning: Permanent Action
 * </DialogTitle>
 */
const DialogTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />
  )
);
DialogTitle.displayName = 'DialogTitle';

/**
 * DialogDescription - Subtitle or description text for the dialog
 *
 * A muted text component for dialog descriptions, subtitles, or supporting information.
 * Typically placed below DialogTitle in the DialogHeader.
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
 * <DialogDescription>
 *   This action will permanently delete all selected items.
 * </DialogDescription>
 *
 * @example
 * // Multi-line description
 * <DialogDescription>
 *   Please review the information carefully before proceeding.
 *   This action cannot be undone.
 * </DialogDescription>
 */
const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
  )
);
DialogDescription.displayName = 'DialogDescription';

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
   