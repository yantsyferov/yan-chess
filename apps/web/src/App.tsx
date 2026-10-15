import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes";
import { ThemeProvider } from "./features/theme/ThemeProvider";
import { AppShell } from "./components/ui/AppShell";

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
}
