
import React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

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

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`} {...props} />
);

const DialogTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />
  )
);

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
  )
);

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
   