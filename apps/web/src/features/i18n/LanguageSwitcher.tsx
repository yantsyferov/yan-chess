import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@yanchess/shared";
import { SUPPORTED_LANGS } from "@yanchess/shared";
import { useLangStore } from "./useLangStore";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/DropdownMenu";

export function LanguageSwitcher(): JSX.Element {
  const { t } = useTranslation("common");
  const current = useLangStore((s) => s.current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-2 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors"
        >
          {t(`languages.${current}`)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGS.map((lang: Lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => {
              useLangStore.getState().setLang(lang);
            }}
            className="justify-between"
          >
            <span>{t(`languages.${lang}`)}</span>
            {lang === current && <Check size={14} className="text-accent ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
