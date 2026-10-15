import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../features/theme/useThemeStore";
import { IconButton } from "./IconButton";

export function ThemeToggle(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggleTheme);
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <IconButton label="Toggle theme" variant="subtle" onClick={toggle}>
      <Icon size={18} aria-hidden />
    </IconButton>
  );
}
