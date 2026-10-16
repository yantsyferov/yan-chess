import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { IconButton } from "../IconButton";
import { Sidebar } from "../Sidebar";

export function SidebarMobileDrawer(): JSX.Element {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <IconButton
          label={t("sidebar.openMenu")}
          variant="ghost"
          className="fixed top-4 left-4 z-50 md:hidden"
        >
          <Menu size={20} aria-hidden />
        </IconButton>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
        <Dialog.Content
          aria-label={t("sidebar.openMenu")}
          className="fixed inset-y-0 left-0 z-50 flex h-full w-[var(--sidebar-width)] flex-col bg-surface-base border-r border-border-subtle shadow-lg focus:outline-none md:hidden"
        >
          <Dialog.Title className="sr-only">{t("sidebar.openMenu")}</Dialog.Title>
          <div className="flex items-center justify-end p-2">
            <Dialog.Close asChild>
              <IconButton label={t("sidebar.closeMenu")} variant="ghost" size="sm">
                <X size={18} aria-hidden />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
