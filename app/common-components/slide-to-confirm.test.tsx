import { beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import SlideToConfirm from "./slide-to-confirm";

// jsdom doesn't implement pointer capture.
beforeAll(() => {
  Element.prototype.setPointerCapture = vi.fn();
});

const pointerEvent = (type: string, props: Record<string, unknown>) =>
  Object.assign(new Event(type, { bubbles: true }), props);

describe("SlideToConfirm", () => {
  it("fires onConfirm exactly once even when pointermove events keep arriving past the threshold", () => {
    const onConfirm = vi.fn();
    const { container } = render(<SlideToConfirm onConfirm={onConfirm} />);
    const thumb = container.querySelector(".cursor-grab")!;

    // pointerdown is discrete so React flushes isDragging=true before the
    // moves. pointermove is continuous-priority: dispatching several in one
    // act() mirrors a real drag, where the setIsDragging(false) render has
    // not landed yet and each stale event re-enters the confirm branch.
    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 1, clientX: 0 }),
      );
    });
    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 1, clientX: 400 }),
      );
      thumb.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 1, clientX: 410 }),
      );
      thumb.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 1, clientX: 420 }),
      );
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not fire onConfirm when released before the threshold, and can confirm on a later drag", () => {
    const onConfirm = vi.fn();
    const { container } = render(<SlideToConfirm onConfirm={onConfirm} />);
    const thumb = container.querySelector(".cursor-grab")!;

    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 1, clientX: 0 }),
      );
    });
    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 5 }),
      );
    });
    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 1, clientX: 400 }),
      );
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // A fresh drag must still be able to confirm (the guard resets).
    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 1, clientX: 0 }),
      );
    });
    act(() => {
      thumb.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 1, clientX: 400 }),
      );
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
