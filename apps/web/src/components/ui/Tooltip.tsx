import type { ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}

export function Tooltip({
  content,
  children,
  side = "top",
  delayDuration = 120,
}: TooltipProps): JSX.Element {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 rounded-md bg-surface-overlay border border-border-subtle px-2 py-1 text-xs text-text-primary shadow-md backdrop-blur-[16px]"
          >
            {content}
            <RadixTooltip.Arrow className="fill-border-subtle" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
