import { forwardRef, useImperativeHandle, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, setup } from "../test/test-utils";
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

    await user.click(screen.getByRole("button", { name: /记录/ }));

    expect(onQuickCreate).not.toHaveBeenCalled();
  });

  it("submits trimmed content and clears the editor", async () => {
    const onQuickCreate = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(<WorkspacePage onQuickCreate={onQuickCreate} />);
    const editor = screen.getByLabelText("今天想记什么？");

    await user.type(editor, "  ## 会议纪要  ");
    await user.click(screen.getByRole("button", { name: /记录/ }));

    expect(onQuickCreate).toHaveBeenCalledWith("## 会议纪要");
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });
});
