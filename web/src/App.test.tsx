import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { defaultSettings } from "./lib/optimizer";
import { defaultPreviewSettings, loadSavedSettings, saveSettings } from "./lib/settings";

describe("App", () => {
  it("renders the privacy-first SVG optimizer workspace", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Pifagor SVG Optimize/i })).toBeInTheDocument();
    expect(screen.getByText(/processed only in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Optimize SVG code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Optimize SVG files/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Optimize SVG files/i }));

    expect(screen.getByText(/Drop SVG files/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Web developer: Pifagor Studio/i })).toHaveAttribute(
      "href",
      "https://pifagor.studio"
    );
  });

  it("opens preset settings in a drawer instead of occupying workspace space", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));

    expect(screen.getByRole("heading", { name: /Preset settings/i })).toBeInTheDocument();
    expect(screen.getByText(/Logo optimization/i)).toBeInTheDocument();
    expect(screen.queryByText(/Contrast grid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Transparent grid/i)).not.toBeInTheDocument();
  });

  it("applies reset defaults to the active preset immediately", () => {
    saveSettings({
      locale: "en",
      settings: { ...defaultSettings, fillColorMode: "custom", fillColor: "#d10000" },
      preview: { ...defaultPreviewSettings, backgroundMode: "light" }
    });

    render(<App />);

    const settingsButton = screen.getByRole("button", { name: /^Settings$/i });
    expect(settingsButton).toHaveClass("has-custom-preset");

    fireEvent.click(settingsButton);
    const drawer = document.querySelector(".settings-drawer") as HTMLElement;
    fireEvent.click(within(drawer).getByRole("button", { name: /Reset defaults/i }));

    expect(settingsButton).not.toHaveClass("has-custom-preset");
    expect(loadSavedSettings()).toEqual({
      locale: "en",
      settings: defaultSettings,
      preview: defaultPreviewSettings
    });
  });

  it("shows feedback when copy is unavailable before optimization", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Copy SVG/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/Optimize SVG first/i);
  });

  it("uses app-rendered dropdown menus instead of native select popups", () => {
    render(<App />);

    expect(document.querySelector("select")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));

    expect(document.querySelector("select")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /currentColor|ZIP|No width/i }).length).toBeGreaterThan(0);
  });
});
