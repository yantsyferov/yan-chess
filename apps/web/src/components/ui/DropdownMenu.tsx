import * as Radix from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const DropdownMenu = Radix.Root;
export const DropdownMenuTrigger = Radix.Trigger;

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Radix.Content>
>(function DropdownMenuContent({ className = "", sideOffset = 4, ...props }, ref) {
  return (
    <Radix.Portal>
      <Radix.Content
        ref={ref}
        sideOffset={sideOffset}
        className={`bg-surface-overlay backdrop-blur-[16px] border border-border-subtle rounded-lg shadow-lg p-1 min-w-[160px] z-50 ${className}`}
        {...props}
      />
    </Radix.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Radix.Item>
>(function DropdownMenuItem({ className = "", ...props }, ref) {
  return (
    <Radix.Item
      ref={ref}
      className={`flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md cursor-pointer data-[highlighted]:bg-surface-elevated data-[highlighted]:text-text-primary focus:outline-none ${className}`}
      {...props}
    />
  );
});

export function DropdownMenuSeparator({ className = "" }: { className?: string }): JSX.Element {
  return <Radix.Separator className={`h-px bg-border-subtle my-1 ${className}`} />;
}
