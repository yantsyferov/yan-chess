import * as Radix from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const Dialog = Radix.Root;
export const DialogTrigger = Radix.Trigger;
export const DialogClose = Radix.Close;

export const DialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Radix.Content>
>(function DialogContent({ className = "", children, ...props }, ref) {
  return (
    <Radix.Portal>
      <Radix.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Radix.Content
        ref={ref}
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface-overlay backdrop-blur-[16px] border border-border-subtle rounded-xl shadow-lg p-6 max-w-md w-[calc(100vw-2rem)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${className}`}
        {...props}
      >
        {children}
      </Radix.Content>
    </Radix.Portal>
  );
});

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof Radix.Title>
>(function DialogTitle({ className = "", ...props }, ref) {
  return (
    <Radix.Title
      ref={ref}
      className={`text-xl font-semibold text-text-primary ${className}`}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof Radix.Description>
>(function DialogDescription({ className = "", ...props }, ref) {
  return (
    <Radix.Description
      ref={ref}
      className={`text-sm text-text-secondary mt-2 ${className}`}
      {...props}
    />
  );
});
