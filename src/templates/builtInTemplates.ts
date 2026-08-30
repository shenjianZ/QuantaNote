import type { TFunction } from "i18next";
import type { TemplateDto } from "../services/tauriCommands";

interface BuiltInTemplateDefinition {
    id: string;
    nameKey: string;
    descriptionKey: string;
    contentKey: string;
}

const BUILT_IN_TEMPLATE_DEFINITIONS: BuiltInTemplateDefinition[] = [
    {
        id: "builtin-daily",
        nameKey: "templates:builtin.daily.name",
        descriptionKey: "templates:builtin.daily.description",
        contentKey: "templates:builtin.daily.content",
    },
    {
        id: "builtin-meeting",
        nameKey: "templates:builtin.meeting.name",
        descriptionKey: "templates:builtin.meeting.description",
        contentKey: "templates:builtin.meeting.content",
    },
    {
        id: "builtin-reading",
        nameKey: "templates:builtin.reading.name",
        descriptionKey: "templates:builtin.reading.description",
        contentKey: "templates:builtin.reading.content",
    },
    {
        id: "builtin-project",
        nameKey: "templates:builtin.project.name",
        descriptionKey: "templates:builtin.project.description",
        contentKey: "templates:builtin.project.content",
    },
];

export function getBuiltInTemplates(t: TFunction): TemplateDto[] {
    return BUILT_IN_TEMPLATE_DEFINITIONS.map((template) => ({
        id: template.id,
        name: t(template.nameKey),
        description: t(template.descriptionKey),
        content: t(template.contentKey),
        built_in: true,
        created_at: "",
        updated_at: "",
    }));
}

export function materializeTemplateContent(template: TemplateDto, date = new Date()): string {
    const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
    const formattedDate = date.toLocaleDateString(locale);
    const formattedTime = date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    });
    return template.content
        .replace(/\{\{date\}\}/g, formattedDate)
        .replace(/\{\{time\}\}/g, formattedTime);
}
