import { describe, expect, it } from "vitest";

import { materializeTemplateContent } from "./builtInTemplates";

describe("materializeTemplateContent", () => {
    it("replaces date and time placeholders throughout the template", () => {
        const result = materializeTemplateContent(
            {
                id: "tpl",
                name: "Template",
                description: "",
                content: "{{date}} / {{time}} / {{date}}",
                built_in: true,
                created_at: "",
                updated_at: "",
            },
            new Date("2026-08-30T08:05:00Z"),
        );

        expect(result).not.toContain("{{date}}");
        expect(result).not.toContain("{{time}}");
        expect(result).toContain("2026");
    });
});
