import { BrowserRouter } from "react-router-dom";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { AppRoutes } from "./routes";
import { ThemeProvider } from "./features/theme/ThemeProvider";
import { AppShell } from "./components/ui/AppShell";

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <RadixTooltip.Provider delayDuration={120} skipDelayDuration={200}>
        <BrowserRouter>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </BrowserRouter>
      </RadixTooltip.Provider>
    </ThemeProvider>
  );
}
