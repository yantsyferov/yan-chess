import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/Card";

interface ModeCardProps {
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  to: string;
  requiresAuth: boolean;
  isAuthenticated: boolean;
}

export function ModeCard({
  icon: Icon,
  titleKey,
  descriptionKey,
  to,
  requiresAuth,
  isAuthenticated,
}: ModeCardProps): JSX.Element {
  const { t } = useTranslation("game");
  const href = requiresAuth && !isAuthenticated ? "/login" : to;

  return (
    <Link to={href} className="block group">
      <Card
        padding="md"
        className="transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-xl cursor-pointer"
      >
        <div className="flex items-start gap-4">
          <Icon size={32} className="text-accent-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-semibold text-text-primary">{t(titleKey)}</p>
            <p className="text-sm text-text-secondary mt-1">{t(descriptionKey)}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
