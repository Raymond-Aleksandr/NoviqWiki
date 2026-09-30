import { writeFile } from "node:fs/promises";
import { permissionKeys } from "../src/modules/authorization/permission-keys";

const cookieSessionSecurity = [{ cookieSession: [] }];
const mutationSecurity = {
  security: cookieSessionSecurity,
  parameters: [
    {
      name: "X-CSRF-Token",
      in: "header",
      required: true,
      schema: { type: "string" },
      description: "Current CSRF value returned by GET /me."
    }
  ]
};

const uuidPathParameter = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" }
});

const jsonRequestBody = (schema: Record<string, unknown>) => ({
  required: true,
  content: { "application/json": { schema } }
});

const groupMutationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", maxLength: 2_000 },
    roleIds: {
      type: "array",
      maxItems: 100,
      items: { type: "string", format: "uuid" },
      default: []
    }
  },
  required: ["name"]
};

const roleMutationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", maxLength: 2_000 },
    permissionKeys: {
      type: "array",
      maxItems: permissionKeys.length,
      items: { type: "string", enum: permissionKeys },
      default: []
    }
  },
  required: ["name"]
};

const spec = {
  openapi: "3.1.0",
  info: {
    title: "NoviqWiki API",
    version: "0.1.0"
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      cookieSession: { type: "apiKey", in: "cookie", name: "noviqwiki_session" }
    }
  },
  paths: {
    "/pages": {
      get: {
        summary: "List pages",
        parameters: [
          { name: "q", in: "query", schema: { type: "string", maxLength: 500 } },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["draft", "published", "archived", "deleted"],
              default: "published"
            }
          },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 }
          }
        ],
        responses: { "200": { description: "Pages" } }
      },
      post: {
        ...mutationSecurity,
        summary: "Create page",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string", maxLength: 220 },
                  slug: { type: "string", maxLength: 240 },
                  markdown: { type: "string", maxLength: 1_000_000, default: "" },
                  editSummary: { type: "string", maxLength: 1_000 },
                  publish: { type: "boolean", default: false }
                },
                required: ["title"]
              }
            }
          }
        },
        responses: { "201": { description: "Page created" } }
      }
    },
    "/pages/{id}": {
      parameters: [uuidPathParameter("id")],
      get: { summary: "Get page", responses: { "200": { description: "Page" } } },
      patch: {
        ...mutationSecurity,
        summary: "Update, rename, publish, archive, protect, or restore page",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: { action: { const: "archive" } },
                    required: ["action"]
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: { action: { const: "restore" } },
                    required: ["action"]
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      protectionLevel: { enum: ["none", "protected"] }
                    },
                    required: ["protectionLevel"]
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string", maxLength: 220 },
                      slug: { type: "string", maxLength: 240 }
                    },
                    required: ["title"]
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      markdown: { type: "string", maxLength: 1_000_000 },
                      editSummary: { type: "string", maxLength: 1_000 },
                      baseRevisionId: { type: ["string", "null"], format: "uuid" }
                    },
                    required: ["markdown"]
                  }
                ]
              }
            }
          }
        },
        responses: { "200": { description: "Updated" } }
      },
      delete: {
        ...mutationSecurity,
        summary: "Soft-delete page",
        responses: { "204": { description: "Deleted" } }
      }
    },
    "/pages/{id}/revisions": {
      parameters: [uuidPathParameter("id")],
      get: { summary: "List revisions", responses: { "200": { description: "Revisions" } } }
    },
    "/pages/{id}/backlinks": {
      parameters: [uuidPathParameter("id")],
      get: {
        summary: "List published pages that link to this page",
        responses: { "200": { description: "Backlinks" } }
      }
    },
    "/revisions/{id}": {
      parameters: [uuidPathParameter("id")],
      get: { summary: "Get revision", responses: { "200": { description: "Revision" } } }
    },
    "/revisions/{from}/diff/{to}": {
      parameters: [uuidPathParameter("from"), uuidPathParameter("to")],
      get: { summary: "Compare revisions", responses: { "200": { description: "Diff" } } }
    },
    "/pages/{id}/rollback": {
      parameters: [uuidPathParameter("id")],
      post: {
        ...mutationSecurity,
        summary: "Rollback page",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  targetRevisionId: { type: "string", format: "uuid" },
                  reason: { type: "string", maxLength: 1_000, default: "" }
                },
                required: ["targetRevisionId"]
              }
            }
          }
        },
        responses: { "200": { description: "Rollback revision" } }
      }
    },
    "/search": {
      get: { summary: "Search pages", responses: { "200": { description: "Results" } } }
    },
    "/categories": {
      get: { summary: "List categories", responses: { "200": { description: "Categories" } } }
    },
    "/categories/{slug}": {
      get: { summary: "Get category", responses: { "200": { description: "Category" } } }
    },
    "/media": {
      get: {
        summary: "List media",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 }
          }
        ],
        responses: { "200": { description: "Media" } }
      },
      post: {
        ...mutationSecurity,
        summary: "Upload media",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  file: { type: "string", format: "binary" },
                  altText: { type: "string", maxLength: 2_000 }
                },
                required: ["file"]
              }
            }
          }
        },
        responses: { "201": { description: "Uploaded" } }
      }
    },
    "/media/{id}": {
      parameters: [uuidPathParameter("id")],
      get: {
        summary: "List content references to a media asset",
        responses: { "200": { description: "Media references" } }
      },
      delete: {
        ...mutationSecurity,
        summary: "Delete media",
        parameters: [
          ...mutationSecurity.parameters,
          {
            name: "force",
            in: "query",
            schema: { type: "boolean", default: false },
            description: "Delete even when content references are present."
          }
        ],
        responses: { "204": { description: "Deleted" } }
      }
    },
    "/me": { get: { summary: "Current user", responses: { "200": { description: "User" } } } },
    "/admin/users": {
      get: {
        security: cookieSessionSecurity,
        summary: "List users",
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Users" } }
      }
    },
    "/admin/users/{id}": {
      parameters: [uuidPathParameter("id")],
      patch: {
        ...mutationSecurity,
        summary: "Update user group memberships",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  groupIds: {
                    type: "array",
                    maxItems: 100,
                    default: [],
                    items: { type: "string", format: "uuid" }
                  }
                }
              }
            }
          }
        },
        responses: { "200": { description: "User groups" } }
      }
    },
    "/admin/groups": {
      get: {
        security: cookieSessionSecurity,
        summary: "List groups",
        responses: { "200": { description: "Groups" } }
      },
      post: {
        ...mutationSecurity,
        summary: "Create group",
        requestBody: jsonRequestBody(groupMutationSchema),
        responses: { "201": { description: "Group" } }
      }
    },
    "/admin/groups/{id}": {
      parameters: [uuidPathParameter("id")],
      patch: {
        ...mutationSecurity,
        summary: "Update group",
        requestBody: jsonRequestBody(groupMutationSchema),
        responses: { "200": { description: "Group" } }
      }
    },
    "/admin/roles": {
      get: {
        security: cookieSessionSecurity,
        summary: "List roles",
        responses: { "200": { description: "Roles" } }
      },
      post: {
        ...mutationSecurity,
        summary: "Create role",
        requestBody: jsonRequestBody(roleMutationSchema),
        responses: { "201": { description: "Role" } }
      }
    },
    "/admin/roles/{id}": {
      parameters: [uuidPathParameter("id")],
      patch: {
        ...mutationSecurity,
        summary: "Update custom role",
        requestBody: jsonRequestBody(roleMutationSchema),
        responses: { "200": { description: "Role" } }
      }
    },
    "/admin/audit": {
      get: {
        security: cookieSessionSecurity,
        summary: "List and filter audit logs",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "action", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }
        ],
        responses: { "200": { description: "Audit logs" } }
      }
    }
  }
};

async function main() {
  await writeFile("docs/openapi.json", `${JSON.stringify(spec, null, 2)}\n`);
  console.log("Wrote docs/openapi.json");
}

void main();
