import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  path: string;
  labelKey: string;
  icon: LucideIcon;
}

interface SidebarMenuProps {
  items: readonly NavItem[];
}

export function SidebarMenu({ items }: SidebarMenuProps): JSX.Element {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <nav aria-label="Main navigation">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-surface-elevated text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                }`}
              >
                <Icon
                  size={18}
                  aria-hidden
                  className={isActive ? "fill-current" : ""}
                />
                <span className="truncate">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
