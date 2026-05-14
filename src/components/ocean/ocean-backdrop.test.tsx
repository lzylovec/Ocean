import { render, screen } from "@testing-library/react";
import { OceanBackdrop } from "@/components/ocean/ocean-backdrop";

describe("OceanBackdrop", () => {
  it("renders the ocean backdrop layers", () => {
    render(<OceanBackdrop />);

    const root = screen.getByTestId("ocean-backdrop");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("bg-gradient-to-b");
    expect(root.querySelector(".ocean-grid")).toBeTruthy();
    expect(root.querySelector(".ocean-surface-glare")).toBeTruthy();
  });
});
