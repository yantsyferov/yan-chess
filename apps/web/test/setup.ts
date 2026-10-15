import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

beforeEach(() => {
  document.documentElement.dataset.theme = "dark";
  localStorage.clear();
});
