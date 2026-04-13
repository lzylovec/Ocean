import { render, screen } from "@testing-library/react";
import { OceanBackdrop } from "@/components/ocean/ocean-backdrop";

describe("OceanBackdrop", () => {
  it("renders and contains fog layers and scanline", () => {
    render(<OceanBackdrop />);

    const root = screen.getByTestId("ocean-backdrop");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.querySelector(".ocean-fog-1")).toBeTruthy();
    expect(root.querySelector(".ocean-fog-2")).toBeTruthy();
    expect(root.querySelector(".ocean-scan")).toBeTruthy();
  });
});
