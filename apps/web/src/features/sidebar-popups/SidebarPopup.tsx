import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useSidebarPopupStore } from "./useSidebarPopupStore";
import type { PopupId } from "./useSidebarPopupStore";

interface SidebarPopupProps {
  id: PopupId;
  trigger: ReactNode;
  children: ReactNode;
}

export function SidebarPopup({ id, trigger, children }: SidebarPopupProps): JSX.Element {
  const openPopup = useSidebarPopupStore((s) => s.openPopup);
  const toggle = useSidebarPopupStore((s) => s.toggle);
  const close = useSidebarPopupStore((s) => s.close);

  const isOpen = openPopup === id;

  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Popover.Trigger asChild onClick={() => toggle(id)}>
        <span>{trigger}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          className="z-50 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-surface border border-border-subtle shadow-lg p-4 focus:outline-none"
          onEscapeKeyDown={close}
          onInteractOutside={close}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
