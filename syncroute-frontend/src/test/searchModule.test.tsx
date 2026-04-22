/**
 * Component tests for SearchModule.
 * Focuses on the nested-button regression and core user interactions.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SearchModule } from "../components/search/SearchModule";

// Mock sub-panels so they don't crash in jsdom
vi.mock("../components/search/LocationPanel", () => ({
  LocationPanel: ({ type, onClose }: any) => (
    <div data-testid={`panel-${type}`}>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock("../components/search/DateSelector", () => ({
  DateSelector: ({ onClose }: any) => (
    <div data-testid="panel-date">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock("../components/search/TimeSelector", () => ({
  TimeSelector: ({ onClose }: any) => (
    <div data-testid="panel-time"><button onClick={onClose}>close</button></div>
  ),
}));
vi.mock("../components/search/PassengerSelector", () => ({
  PassengerSelector: ({ onClose }: any) => (
    <div data-testid="panel-passengers"><button onClick={onClose}>close</button></div>
  ),
}));

function renderModule(props = {}) {
  return render(
    <MemoryRouter>
      <SearchModule {...props} />
    </MemoryRouter>
  );
}

describe("SearchModule", () => {
  it("renders without crashing", () => {
    renderModule();
  });

  it("shows placeholder text for empty from/to fields", () => {
    renderModule();
    const placeholders = screen.getAllByText("Enter city or place");
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it("renders a Search button", () => {
    renderModule();
    const searchBtns = screen.getAllByRole("button", { name: /search/i });
    expect(searchBtns.length).toBeGreaterThan(0);
  });

  it("does NOT contain a <button> inside another <button> (nested-button fix)", () => {
    const { container } = renderModule({
      initialFrom: "Chennai",
      initialFromCoords: { lat: 13.08, lng: 80.27 },
      initialTo: "Bengaluru",
      initialToCoords: { lat: 12.97, lng: 77.59 },
    });

    const allButtons = Array.from(container.querySelectorAll("button"));
    for (const btn of allButtons) {
      const nestedBtn = btn.querySelector("button");
      expect(nestedBtn).toBeNull();
    }
  });

  it("swap button uses role=button div (not <button>) to avoid nesting", () => {
    const { container } = renderModule({
      initialFrom: "Chennai",
      initialFromCoords: { lat: 13.08, lng: 80.27 },
      initialTo: "Bengaluru",
      initialToCoords: { lat: 12.97, lng: 77.59 },
    });

    // The swap element in mobile layout must be a div, not a button
    const swapEl = container.querySelector('[role="button"]');
    expect(swapEl).not.toBeNull();
    expect(swapEl!.tagName.toLowerCase()).toBe("div");
  });

  it("shows a Search alert when from/to are empty", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderModule();
    // click any Search button
    const searchBtns = screen.getAllByRole("button", { name: /search/i });
    fireEvent.click(searchBtns[0]);
    expect(alertSpy).toHaveBeenCalledWith(
      "Please select both origin and destination"
    );
    alertSpy.mockRestore();
  });

  it("pre-populates from/to when passed as initial props", () => {
    renderModule({
      initialFrom: "Mumbai",
      initialTo: "Pune",
    });
    expect(screen.getAllByText("Mumbai").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pune").length).toBeGreaterThan(0);
  });

  it("pre-populates passenger count", () => {
    renderModule({ initialPassengers: 3 });
    // Should show "3 Passengers"
    expect(screen.getAllByText(/3 Passengers/i).length).toBeGreaterThan(0);
  });
});
