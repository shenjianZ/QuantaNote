import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { setup } from "../../test/test-utils";
import { TemplatePickerModal } from "./TemplatePickerModal";
import * as templateCommands from "../../services/tauriCommands";

vi.mock("../../services/tauriCommands", async () => {
    const actual = await vi.importActual<typeof import("../../services/tauriCommands")>(
        "../../services/tauriCommands",
    );
    return {
        ...actual,
        getTemplates: vi.fn(),
        createTemplate: vi.fn(),
        updateTemplate: vi.fn(),
        deleteTemplate: vi.fn(),
    };
});

const userTemplate = {
    id: "tpl-1",
    name: "周复盘",
    description: "整理本周进展",
    content: "# 周复盘",
    built_in: false,
    created_at: "2026-08-30T00:00:00Z",
    updated_at: "2026-08-30T00:00:00Z",
};

describe("TemplatePickerModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(templateCommands.getTemplates).mockResolvedValue([]);
        vi.mocked(templateCommands.createTemplate).mockResolvedValue(userTemplate);
        vi.mocked(templateCommands.updateTemplate).mockResolvedValue(userTemplate);
        vi.mocked(templateCommands.deleteTemplate).mockResolvedValue(undefined);
    });

    it("shows blank and built-in template choices", async () => {
        setup(<TemplatePickerModal open onClose={vi.fn()} onSelect={vi.fn(async () => {})} />);

        await waitFor(() => expect(screen.getByTestId("template-picker-modal")).toBeInTheDocument());
        expect(screen.getByTestId("template-blank-btn")).toBeInTheDocument();
        expect(screen.getByTestId("template-option-builtin-daily")).toBeInTheDocument();
        expect(screen.getByTestId("template-option-builtin-meeting")).toBeInTheDocument();
        expect(screen.getByTestId("template-option-builtin-reading")).toBeInTheDocument();
        expect(screen.getByTestId("template-option-builtin-project")).toBeInTheDocument();
    });

    it("passes a blank selection to the parent", async () => {
        const onSelect = vi.fn(async () => {});
        const { user } = setup(<TemplatePickerModal open onClose={vi.fn()} onSelect={onSelect} />);

        await user.click(await screen.findByTestId("template-blank-btn"));
        await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
    });

    it("creates a custom template from the manage view", async () => {
        const { user } = setup(<TemplatePickerModal open onClose={vi.fn()} onSelect={vi.fn(async () => {})} />);

        await user.click(await screen.findByTestId("template-manage-btn"));
        await user.click(screen.getByTestId("template-create-btn"));
        await user.type(screen.getByTestId("template-name-input"), "周复盘");
        await user.type(screen.getByTestId("template-content-input"), "# 周复盘");
        await user.click(screen.getByTestId("template-save-btn"));

        await waitFor(() =>
            expect(templateCommands.createTemplate).toHaveBeenCalledWith("周复盘", "", "# 周复盘"),
        );
        expect(await screen.findByText("整理本周进展")).toBeInTheDocument();
    });

    it("requires two clicks before deleting a custom template", async () => {
        vi.mocked(templateCommands.getTemplates).mockResolvedValue([userTemplate]);
        const { user } = setup(<TemplatePickerModal open onClose={vi.fn()} onSelect={vi.fn(async () => {})} />);

        await user.click(await screen.findByTestId("template-manage-btn"));
        const deleteButton = await screen.findByTestId("template-delete-tpl-1");
        await user.click(deleteButton);
        expect(templateCommands.deleteTemplate).not.toHaveBeenCalled();
        await user.click(deleteButton);

        await waitFor(() => expect(templateCommands.deleteTemplate).toHaveBeenCalledWith("tpl-1"));
    });
});
