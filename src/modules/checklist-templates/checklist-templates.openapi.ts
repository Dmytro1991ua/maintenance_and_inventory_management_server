import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  ChecklistCategoryParamSchema,
  ChecklistTemplateResponseSchema,
  ChecklistTemplatesListResponseSchema,
  UpdateChecklistTemplateSchema,
} from "./checklist-templates.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/checklist-templates",
  description: "List checklist templates for all categories. All authenticated users.",
  tags: ["Checklist Templates"],
  security: bearerAuth,
  responses: {
    200: {
      description: "All checklist templates",
      content: { "application/json": { schema: ChecklistTemplatesListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/checklist-templates/{category}",
  description: "Get checklist template for a specific inventory category.",
  tags: ["Checklist Templates"],
  security: bearerAuth,
  request: { params: ChecklistCategoryParamSchema },
  responses: {
    200: {
      description: "Checklist template found",
      content: { "application/json": { schema: ChecklistTemplateResponseSchema } },
    },
    404: {
      description: "No template exists for this category",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/checklist-templates/{category}",
  description:
    "Update checklist items for a category. ADMIN or MANAGER only. Creates the template if it does not yet exist.",
  tags: ["Checklist Templates"],
  security: bearerAuth,
  request: {
    params: ChecklistCategoryParamSchema,
    body: { content: { "application/json": { schema: UpdateChecklistTemplateSchema } } },
  },
  responses: {
    200: {
      description: "Template updated",
      content: { "application/json": { schema: ChecklistTemplateResponseSchema } },
    },
    403: {
      description: "ADMIN or MANAGER role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
