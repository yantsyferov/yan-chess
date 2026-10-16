import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { useLangStore } from "../i18n/useLangStore";
import { COUNTRIES } from "../../data/countries";
import type { CountryEntry } from "../../data/countries";

export interface CountryPickerProps {
  value: string | null;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function getLocalizedName(entry: CountryEntry, locale: string): string {
  if (locale === "ru") return entry.names.ru;
  if (locale === "es") return entry.names.es;
  return entry.names.en;
}

export function CountryPicker({
  value,
  onChange,
  placeholder,
  disabled = false,
}: CountryPickerProps): JSX.Element {
  const { t } = useTranslation("common");
  const locale = useLangStore((s) => s.current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = value ? COUNTRIES.find((c) => c.code === value) ?? null : null;

  const filtered =
    query.trim() === ""
      ? COUNTRIES
      : COUNTRIES.filter((c) => {
          const q = query.toLowerCase();
          return (
            c.names.en.toLowerCase().includes(q) ||
            c.names.ru.toLowerCase().includes(q) ||
            c.names.es.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q)
          );
        });

  const handleSelect = useCallback(
    (code: string) => {
      onChange(code);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  const displayPlaceholder = placeholder ?? t("country.placeholder");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={
            selected ? `${selected.flag} ${getLocalizedName(selected, locale)}` : t("country.whiteFlag")
          }
          className={[
            "inline-flex items-center gap-2 w-full rounded-lg bg-surface-elevated border px-3 py-2.5",
            "text-left text-text-primary focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-accent transition-colors",
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "border-border-subtle hover:border-border-strong cursor-pointer",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {selected ? (
            <>
              <span aria-hidden="true">{selected.flag}</span>
              <span>{getLocalizedName(selected, locale)}</span>
            </>
          ) : (
            <span className="text-text-muted">{displayPlaceholder}</span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-lg border border-border-subtle bg-surface shadow-lg"
        >
          <div className="p-2 border-b border-border-subtle">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("country.searchPlaceholder")}
              className="w-full rounded-md bg-surface-elevated border border-border-subtle px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <ul
            role="listbox"
            className="max-h-[300px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">{t("empty.title")}</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code} role="option" aria-selected={c.code === value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={[
                      "flex w-full items-center gap-2 px-3 py-2 text-sm text-left",
                      "hover:bg-surface-elevated transition-colors",
                      c.code === value ? "text-accent font-medium" : "text-text-primary",
                    ].join(" ")}
                  >
                    <span aria-hidden="true">{c.flag}</span>
                    <span>{getLocalizedName(c, locale)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
