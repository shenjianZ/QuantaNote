import { forwardRef, useImperativeHandle, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, setup, waitFor } from "../test/test-utils";
import { WorkspacePage } from "./WorkspacePage";

vi.mock("../components/editor/VditorEditor", () => ({
  VditorEditor: forwardRef<
    { getValue: () => string; focus: () => void },
    { initialValue: string; onChange: (value: string) => void; placeholder?: string }
  >(function MockVditorEditor({ initialValue, onChange, placeholder }, ref) {
    const [value, setValue] = useState(initialValue);
    useImperativeHandle(ref, () => ({
      getValue: () => value,
      setValue: (v: string) => setValue(v),
      focus: vi.fn(),
    }), [value]);

    return (
      <textarea
        aria-label={placeholder ?? "editor"}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          onChange(event.currentTarget.value);
        }}
      />
    );
  }),
}));

describe("WorkspacePage", () => {
  it("does not submit empty content", async () => {
    const onQuickCreate = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(<WorkspacePage onQuickCreate={onQuickCreate} />);

    const saveButton = screen.getByRole("button", { name: /记录/ });
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);

    expect(onQuickCreate).not.toHaveBeenCalled();
  });

  it("submits trimmed content, clears the editor, and exposes the saved note shortcut", async () => {
    const onQuickCreate = vi.fn().mockResolvedValue(undefined);
    const onViewSaved = vi.fn();
    const { user } = setup(<WorkspacePage onQuickCreate={onQuickCreate} onViewSaved={onViewSaved} />);
    const editor = screen.getByLabelText("今天想记什么？");

    await user.type(editor, "  ## 会议纪要  ");
    await user.click(screen.getByRole("button", { name: /记录/ }));

    expect(onQuickCreate).toHaveBeenCalledWith("## 会议纪要");
    await waitFor(() => expect(screen.getByText("已保存")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /查看记录/ }));
    expect(onViewSaved).toHaveBeenCalledTimes(1);
  });
});
