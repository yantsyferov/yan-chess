import "@testing-library/jest-dom/vitest";
import "../src/i18n";
import { beforeEach } from "vitest";

beforeEach(() => {
  document.documentElement.dataset.theme = "dark";
  localStorage.clear();
});
