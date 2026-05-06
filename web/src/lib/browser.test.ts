import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard, downloadText } from "./browser";

const originalClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

describe("browser utilities", () => {
  afterEach(() => {
    restoreProperty(Navigator.prototype, "clipboard", originalClipboard);
    restoreProperty(window, "isSecureContext", originalSecureContext);
    restoreProperty(document, "execCommand", originalExecCommand);
    restoreProperty(URL, "createObjectURL", originalCreateObjectUrl);
    restoreProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("falls back to textarea copy when Clipboard API is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    const execCommand = vi.fn().mockReturnValue(true);

    Object.defineProperty(Navigator.prototype, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand
    });

    await copyToClipboard("<svg />");

    expect(writeText).toHaveBeenCalledWith("<svg />");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("starts SVG downloads and revokes blob URLs after the click can complete", () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn().mockReturnValue("blob:svg-download");
    const revokeObjectURL = vi.fn();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });

    downloadText("icon-opt.svg", "<svg />");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a[download='icon-opt.svg']")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:svg-download");
  });
});

function restoreProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<PropertyKey, unknown>)[key];
}
