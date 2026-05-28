import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { MOBILE_BACK_EVENT } from "../../utils/platform";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("closes and consumes the mobile back event", () => {
    const onClose = vi.fn();

    setup(
      <Modal open={true} onClose={onClose} title="测试弹窗">
        <p>弹窗内容</p>
      </Modal>
    );

    expect(screen.getByRole("dialog", { name: "测试弹窗" })).toBeInTheDocument();

    const event = new Event(MOBILE_BACK_EVENT, { cancelable: true });
    const dispatched = window.dispatchEvent(event);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(dispatched).toBe(false);
  });
});
