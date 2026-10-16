import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarPopupStore } from "../useSidebarPopupStore";

beforeEach(() => {
  useSidebarPopupStore.setState({ openPopup: null });
});

describe("useSidebarPopupStore", () => {
  it("starts with no popup open", () => {
    expect(useSidebarPopupStore.getState().openPopup).toBeNull();
  });

  it("open(id) opens that popup", () => {
    useSidebarPopupStore.getState().open("settings");
    expect(useSidebarPopupStore.getState().openPopup).toBe("settings");
  });

  it("close() closes any open popup", () => {
    useSidebarPopupStore.getState().open("friends");
    useSidebarPopupStore.getState().close();
    expect(useSidebarPopupStore.getState().openPopup).toBeNull();
  });

  it("toggle(id) opens a closed popup", () => {
    useSidebarPopupStore.getState().toggle("chat");
    expect(useSidebarPopupStore.getState().openPopup).toBe("chat");
  });

  it("toggle(id) closes an already-open popup with the same id", () => {
    useSidebarPopupStore.getState().open("notifications");
    useSidebarPopupStore.getState().toggle("notifications");
    expect(useSidebarPopupStore.getState().openPopup).toBeNull();
  });

  it("opening a second popup closes the first (only one at a time)", () => {
    useSidebarPopupStore.getState().open("settings");
    useSidebarPopupStore.getState().open("friends");
    expect(useSidebarPopupStore.getState().openPopup).toBe("friends");
  });

  it("toggle to different id closes current and opens new", () => {
    useSidebarPopupStore.getState().open("settings");
    useSidebarPopupStore.getState().toggle("friends");
    expect(useSidebarPopupStore.getState().openPopup).toBe("friends");
  });
});
