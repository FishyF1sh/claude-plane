#!/usr/bin/env node
/**
 * Plane MCP Server
 * Provides MCP tools for interacting with Plane project management
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "fs";
import {
  PlaneClient,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateCycleInput,
  UpdateCycleInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateStateInput,
  UpdateStateInput,
  CreateLabelInput,
  UpdateLabelInput,
  CreateCommentInput,
  UpdateCommentInput,
  CreateLinkInput,
  UpdateLinkInput,
  CreateWorklogInput,
  UpdateWorklogInput,
  CreateInitiativeInput,
  UpdateInitiativeInput,
} from "./plane-client.js";
import { PlaneWatcher, WatcherConfig, loadConfig as loadWatcherConfig } from "./watcher.js";

// Load configuration from file or environment variables
interface PlaneConfig {
  plane: {
    baseUrl: string;
    apiKey: string;
    workspace: string;
    project?: string;
  };
  watch?: {
    pollIntervalSeconds: number;
    triggerLabel: string;
    triggers?: {
      onLabelAdded?: boolean;
      onReopened?: boolean;
      onNewComment?: boolean;
    };
  };
  claude?: {
    prompt: string;
  };
}

function loadConfig(): { baseUrl: string; apiKey: string; workspace: string; fullConfig: PlaneConfig | null } {
  const configPath = process.env.PLANE_CONFIG;

  // Try loading from config file first
  if (configPath && existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content) as PlaneConfig;
      return {
        baseUrl: config.plane.baseUrl,
        apiKey: config.plane.apiKey,
        workspace: config.plane.workspace || "",
        fullConfig: config,
      };
    } catch (e) {
      console.error(`Error reading config file ${configPath}:`, e);
      process.exit(1);
    }
  }

  // Fall back to environment variables
  return {
    baseUrl: process.env.PLANE_BASE_URL || "",
    apiKey: process.env.PLANE_API_KEY || "",
    workspace: process.env.PLANE_WORKSPACE_SLUG || "",
    fullConfig: null,
  };
}

const config = loadConfig();
const PLANE_BASE_URL = config.baseUrl;
const PLANE_API_KEY = config.apiKey;
const PLANE_WORKSPACE_SLUG = config.workspace;
const FULL_CONFIG = config.fullConfig;

// Watcher instance (singleton, managed via MCP tools)
let watcherInstance: PlaneWatcher | null = null;
const watcherLogs: string[] = [];

if (!PLANE_API_KEY) {
  console.error("Error: PLANE_API_KEY is required (via PLANE_CONFIG file or PLANE_API_KEY env var)");
  process.exit(1);
}

if (!PLANE_BASE_URL) {
  console.error("Error: PLANE_BASE_URL is required (via PLANE_CONFIG file or PLANE_BASE_URL env var)");
  process.exit(1);
}

// Helper to get workspace slug from args or default
function getWorkspaceSlug(args: Record<string, unknown>): string {
  const slug = (args.workspace_slug as string) || PLANE_WORKSPACE_SLUG;
  if (!slug) {
    throw new Error("workspace_slug is required (provide it as a parameter or set PLANE_WORKSPACE_SLUG env var)");
  }
  return slug;
}

const client = new PlaneClient({
  baseUrl: PLANE_BASE_URL,
  apiKey: PLANE_API_KEY,
});

// Tool definitions
const tools: Tool[] = [
  // Note: Plane API doesn't have a "list workspaces" endpoint
  // Users need to know their workspace slug (visible in URL)

  // Project tools
  {
    name: "plane_list_projects",
    description: "List all projects in a workspace",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
      },
      required: [],
    },
  },
  {
    name: "plane_get_project",
    description: "Get details of a specific project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_create_project",
    description: "Create a new project in a workspace",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        name: {
          type: "string",
          description: "Project name",
        },
        identifier: {
          type: "string",
          description: "Project identifier (e.g., 'PROJ')",
        },
        description: {
          type: "string",
          description: "Project description",
        },
        network: {
          type: "number",
          description: "Network setting (0 = secret, 2 = public)",
        },
      },
      required: ["name", "identifier"],
    },
  },
  {
    name: "plane_update_project",
    description: "Update an existing project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        name: {
          type: "string",
          description: "New project name",
        },
        description: {
          type: "string",
          description: "New project description",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_delete_project",
    description: "Delete a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },

  // Work Item tools
  {
    name: "plane_list_work_items",
    description: "List all work items (issues) in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor for next page",
        },
        per_page: {
          type: "number",
          description: "Number of items per page (max 100)",
        },
        expand: {
          type: "string",
          description: "Related fields to expand (e.g., 'assignees,state')",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_get_work_item",
    description: "Get details of a specific work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },
  // Note: plane_get_work_item_by_identifier and plane_search_work_items
  // are not available in Plane v1.2.1
  {
    name: "plane_create_work_item",
    description: "Create a new work item (issue) in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        name: {
          type: "string",
          description: "Work item name/title",
        },
        description_html: {
          type: "string",
          description: "Description in HTML format",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Priority level",
        },
        state: {
          type: "string",
          description: "State ID",
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Array of assignee user IDs",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Array of label IDs",
        },
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        target_date: {
          type: "string",
          description: "Target/due date (YYYY-MM-DD)",
        },
        parent: {
          type: "string",
          description: "Parent work item ID for sub-issues",
        },
        estimate_point: {
          type: "number",
          description: "Estimate points",
        },
      },
      required: ["project_id", "name"],
    },
  },
  {
    name: "plane_update_work_item",
    description: "Update an existing work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        name: {
          type: "string",
          description: "New name/title",
        },
        description_html: {
          type: "string",
          description: "New description in HTML format",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Priority level",
        },
        state: {
          type: "string",
          description: "State ID",
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Array of assignee user IDs",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Array of label IDs",
        },
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        target_date: {
          type: "string",
          description: "Target/due date (YYYY-MM-DD)",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },
  {
    name: "plane_delete_work_item",
    description: "Delete a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },

  // Cycle tools
  {
    name: "plane_list_cycles",
    description: "List all cycles (sprints) in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_get_cycle",
    description: "Get details of a specific cycle",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        cycle_id: {
          type: "string",
          description: "The cycle ID",
        },
      },
      required: ["project_id", "cycle_id"],
    },
  },
  {
    name: "plane_create_cycle",
    description: "Create a new cycle (sprint) in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        name: {
          type: "string",
          description: "Cycle name",
        },
        description: {
          type: "string",
          description: "Cycle description",
        },
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        end_date: {
          type: "string",
          description: "End date (YYYY-MM-DD)",
        },
      },
      required: ["project_id", "name"],
    },
  },
  {
    name: "plane_update_cycle",
    description: "Update an existing cycle",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        cycle_id: {
          type: "string",
          description: "The cycle ID",
        },
        name: {
          type: "string",
          description: "New cycle name",
        },
        description: {
          type: "string",
          description: "New description",
        },
        start_date: {
          type: "string",
          description: "New start date (YYYY-MM-DD)",
        },
        end_date: {
          type: "string",
          description: "New end date (YYYY-MM-DD)",
        },
      },
      required: ["project_id", "cycle_id"],
    },
  },
  {
    name: "plane_delete_cycle",
    description: "Delete a cycle",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        cycle_id: {
          type: "string",
          description: "The cycle ID",
        },
      },
      required: ["project_id", "cycle_id"],
    },
  },
  {
    name: "plane_add_work_items_to_cycle",
    description: "Add work items to a cycle",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        cycle_id: {
          type: "string",
          description: "The cycle ID",
        },
        work_item_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of work item IDs to add",
        },
      },
      required: ["project_id", "cycle_id", "work_item_ids"],
    },
  },
  {
    name: "plane_remove_work_item_from_cycle",
    description: "Remove a work item from a cycle",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        cycle_id: {
          type: "string",
          description: "The cycle ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID to remove",
        },
      },
      required: ["project_id", "cycle_id", "work_item_id"],
    },
  },

  // Module tools
  {
    name: "plane_list_modules",
    description: "List all modules in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_get_module",
    description: "Get details of a specific module",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        module_id: {
          type: "string",
          description: "The module ID",
        },
      },
      required: ["project_id", "module_id"],
    },
  },
  {
    name: "plane_create_module",
    description: "Create a new module in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        name: {
          type: "string",
          description: "Module name",
        },
        description: {
          type: "string",
          description: "Module description",
        },
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        target_date: {
          type: "string",
          description: "Target date (YYYY-MM-DD)",
        },
        status: {
          type: "string",
          description: "Module status",
        },
        lead: {
          type: "string",
          description: "Lead user ID",
        },
        members: {
          type: "array",
          items: { type: "string" },
          description: "Array of member user IDs",
        },
      },
      required: ["project_id", "name"],
    },
  },
  {
    name: "plane_update_module",
    description: "Update an existing module",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        module_id: {
          type: "string",
          description: "The module ID",
        },
        name: {
          type: "string",
          description: "New module name",
        },
        description: {
          type: "string",
          description: "New description",
        },
        start_date: {
          type: "string",
          description: "New start date (YYYY-MM-DD)",
        },
        target_date: {
          type: "string",
          description: "New target date (YYYY-MM-DD)",
        },
        status: {
          type: "string",
          description: "New status",
        },
      },
      required: ["project_id", "module_id"],
    },
  },
  {
    name: "plane_delete_module",
    description: "Delete a module",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        module_id: {
          type: "string",
          description: "The module ID",
        },
      },
      required: ["project_id", "module_id"],
    },
  },
  {
    name: "plane_add_work_items_to_module",
    description: "Add work items to a module",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        module_id: {
          type: "string",
          description: "The module ID",
        },
        work_item_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of work item IDs to add",
        },
      },
      required: ["project_id", "module_id", "work_item_ids"],
    },
  },
  {
    name: "plane_remove_work_item_from_module",
    description: "Remove a work item from a module",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        module_id: {
          type: "string",
          description: "The module ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID to remove",
        },
      },
      required: ["project_id", "module_id", "work_item_id"],
    },
  },

  // State tools
  {
    name: "plane_list_states",
    description: "List all states in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_create_state",
    description: "Create a new state in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        name: {
          type: "string",
          description: "State name",
        },
        color: {
          type: "string",
          description: "State color (hex code)",
        },
        group: {
          type: "string",
          enum: ["backlog", "unstarted", "started", "completed", "cancelled"],
          description: "State group",
        },
        sequence: {
          type: "number",
          description: "Display sequence order",
        },
      },
      required: ["project_id", "name", "color", "group"],
    },
  },
  {
    name: "plane_update_state",
    description: "Update an existing state",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        state_id: {
          type: "string",
          description: "The state ID",
        },
        name: {
          type: "string",
          description: "New state name",
        },
        color: {
          type: "string",
          description: "New color (hex code)",
        },
        group: {
          type: "string",
          enum: ["backlog", "unstarted", "started", "completed", "cancelled"],
          description: "New state group",
        },
      },
      required: ["project_id", "state_id"],
    },
  },
  {
    name: "plane_delete_state",
    description: "Delete a state",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        state_id: {
          type: "string",
          description: "The state ID",
        },
      },
      required: ["project_id", "state_id"],
    },
  },

  // Label tools
  {
    name: "plane_list_labels",
    description: "List all labels in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "plane_create_label",
    description: "Create a new label in a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        name: {
          type: "string",
          description: "Label name",
        },
        color: {
          type: "string",
          description: "Label color (hex code)",
        },
        description: {
          type: "string",
          description: "Label description",
        },
      },
      required: ["project_id", "name"],
    },
  },
  {
    name: "plane_update_label",
    description: "Update an existing label",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        label_id: {
          type: "string",
          description: "The label ID",
        },
        name: {
          type: "string",
          description: "New label name",
        },
        color: {
          type: "string",
          description: "New color (hex code)",
        },
        description: {
          type: "string",
          description: "New description",
        },
      },
      required: ["project_id", "label_id"],
    },
  },
  {
    name: "plane_delete_label",
    description: "Delete a label",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        label_id: {
          type: "string",
          description: "The label ID",
        },
      },
      required: ["project_id", "label_id"],
    },
  },

  // Comment tools
  {
    name: "plane_list_comments",
    description: "List all comments on a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },
  {
    name: "plane_create_comment",
    description: "Add a comment to a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        comment_html: {
          type: "string",
          description: "Comment content in HTML format",
        },
      },
      required: ["project_id", "work_item_id", "comment_html"],
    },
  },
  {
    name: "plane_update_comment",
    description: "Update an existing comment",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        comment_id: {
          type: "string",
          description: "The comment ID",
        },
        comment_html: {
          type: "string",
          description: "New comment content in HTML format",
        },
      },
      required: ["project_id", "work_item_id", "comment_id", "comment_html"],
    },
  },
  {
    name: "plane_delete_comment",
    description: "Delete a comment",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        comment_id: {
          type: "string",
          description: "The comment ID",
        },
      },
      required: ["project_id", "work_item_id", "comment_id"],
    },
  },

  // Link tools
  {
    name: "plane_list_links",
    description: "List all links attached to a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },
  {
    name: "plane_create_link",
    description: "Add a link to a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        title: {
          type: "string",
          description: "Link title",
        },
        url: {
          type: "string",
          description: "Link URL",
        },
      },
      required: ["project_id", "work_item_id", "title", "url"],
    },
  },
  {
    name: "plane_delete_link",
    description: "Delete a link from a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        link_id: {
          type: "string",
          description: "The link ID",
        },
      },
      required: ["project_id", "work_item_id", "link_id"],
    },
  },

  // Activity tools
  {
    name: "plane_list_activities",
    description: "List all activities (history) for a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },

  // Member tools
  {
    name: "plane_list_workspace_members",
    description: "List all members of a workspace",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
      },
      required: [],
    },
  },
  {
    name: "plane_list_project_members",
    description: "List all members of a project",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional - uses PLANE_WORKSPACE_SLUG env var if not provided)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["project_id"],
    },
  },

  // User tools
  {
    name: "plane_get_current_user",
    description: "Get information about the currently authenticated user",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  // Note: Worklogs, Epics, and Initiatives are not available in Plane v1.2.1

  // Attachment tools
  {
    name: "plane_list_attachments",
    description: "List all attachments for a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional if PLANE_WORKSPACE_SLUG env var is set)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
      },
      required: ["project_id", "work_item_id"],
    },
  },
  {
    name: "plane_upload_attachment",
    description: "Upload a file as an attachment to a work item. The file should be base64 encoded.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional if PLANE_WORKSPACE_SLUG env var is set)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        file_base64: {
          type: "string",
          description: "Base64 encoded file content",
        },
        filename: {
          type: "string",
          description: "Filename including extension (e.g., 'screenshot.png')",
        },
        mime_type: {
          type: "string",
          description: "MIME type of the file (e.g., 'image/png')",
        },
      },
      required: ["project_id", "work_item_id", "file_base64", "filename", "mime_type"],
    },
  },
  {
    name: "plane_delete_attachment",
    description: "Delete an attachment from a work item",
    inputSchema: {
      type: "object",
      properties: {
        workspace_slug: {
          type: "string",
          description: "The workspace slug (optional if PLANE_WORKSPACE_SLUG env var is set)",
        },
        project_id: {
          type: "string",
          description: "The project ID",
        },
        work_item_id: {
          type: "string",
          description: "The work item ID",
        },
        attachment_id: {
          type: "string",
          description: "The attachment ID",
        },
      },
      required: ["project_id", "work_item_id", "attachment_id"],
    },
  },

  // Watcher tools
  {
    name: "plane_watcher_start",
    description: "Start the Plane watcher that monitors for work items with a trigger label and spawns Claude to handle them. Requires a plane.config.json with watch and claude sections configured.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "plane_watcher_stop",
    description: "Stop the running Plane watcher",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "plane_watcher_status",
    description: "Get the current status of the Plane watcher, including whether it's running, tracked items, and recent logs",
    inputSchema: {
      type: "object",
      properties: {
        include_logs: {
          type: "boolean",
          description: "Include recent log messages in the response (default: true)",
        },
      },
      required: [],
    },
  },
];

// Tool handler
async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    // Project handlers
    case "plane_list_projects":
      return client.listProjects(getWorkspaceSlug(args));

    case "plane_get_project":
      return client.getProject(
        getWorkspaceSlug(args),
        args.project_id as string
      );

    case "plane_create_project": {
      const input: CreateProjectInput = {
        name: args.name as string,
        identifier: args.identifier as string,
        description: args.description as string | undefined,
        network: args.network as number | undefined,
      };
      return client.createProject(getWorkspaceSlug(args), input);
    }

    case "plane_update_project": {
      const input: UpdateProjectInput = {};
      if (args.name) input.name = args.name as string;
      if (args.description) input.description = args.description as string;
      if (args.network !== undefined) input.network = args.network as number;
      return client.updateProject(
        getWorkspaceSlug(args),
        args.project_id as string,
        input
      );
    }

    case "plane_delete_project":
      await client.deleteProject(
        getWorkspaceSlug(args),
        args.project_id as string
      );
      return { success: true };

    // Work Item handlers
    case "plane_list_work_items":
      return client.listWorkItems(
        getWorkspaceSlug(args),
        args.project_id as string,
        {
          cursor: args.cursor as string | undefined,
          per_page: args.per_page as number | undefined,
          expand: args.expand as string | undefined,
        }
      );

    case "plane_get_work_item":
      return client.getWorkItem(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string
      );

    // Note: plane_get_work_item_by_identifier and plane_search_work_items
    // are not available in Plane v1.2.1

    case "plane_create_work_item": {
      const input: CreateWorkItemInput = {
        name: args.name as string,
        description_html: args.description_html as string | undefined,
        priority: args.priority as CreateWorkItemInput["priority"],
        state: args.state as string | undefined,
        assignees: args.assignees as string[] | undefined,
        labels: args.labels as string[] | undefined,
        start_date: args.start_date as string | undefined,
        target_date: args.target_date as string | undefined,
        parent: args.parent as string | undefined,
        estimate_point: args.estimate_point as number | undefined,
      };
      return client.createWorkItem(
        getWorkspaceSlug(args),
        args.project_id as string,
        input
      );
    }

    case "plane_update_work_item": {
      const input: UpdateWorkItemInput = {};
      if (args.name) input.name = args.name as string;
      if (args.description_html) input.description_html = args.description_html as string;
      if (args.priority) input.priority = args.priority as UpdateWorkItemInput["priority"];
      if (args.state) input.state = args.state as string;
      if (args.assignees) input.assignees = args.assignees as string[];
      if (args.labels) input.labels = args.labels as string[];
      if (args.start_date) input.start_date = args.start_date as string;
      if (args.target_date) input.target_date = args.target_date as string;
      return client.updateWorkItem(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        input
      );
    }

    case "plane_delete_work_item":
      await client.deleteWorkItem(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string
      );
      return { success: true };

    // Cycle handlers
    case "plane_list_cycles":
      return client.listCycles(
        getWorkspaceSlug(args),
        args.project_id as string
      );

    case "plane_get_cycle":
      return client.getCycle(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.cycle_id as string
      );

    case "plane_create_cycle": {
      const input: CreateCycleInput = {
        name: args.name as string,
        description: args.description as string | undefined,
        start_date: args.start_date as string | undefined,
        end_date: args.end_date as string | undefined,
      };
      return client.createCycle(
        getWorkspaceSlug(args),
        args.project_id as string,
        input
      );
    }

    case "plane_update_cycle": {
      const input: UpdateCycleInput = {};
      if (args.name) input.name = args.name as string;
      if (args.description) input.description = args.description as string;
      if (args.start_date) input.start_date = args.start_date as string;
      if (args.end_date) input.end_date = args.end_date as string;
      return client.updateCycle(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.cycle_id as string,
        input
      );
    }

    case "plane_delete_cycle":
      await client.deleteCycle(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.cycle_id as string
      );
      return { success: true };

    case "plane_add_work_items_to_cycle":
      await client.addWorkItemsToCycle(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.cycle_id as string,
        args.work_item_ids as string[]
      );
      return { success: true };

    case "plane_remove_work_item_from_cycle":
      await client.removeWorkItemFromCycle(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.cycle_id as string,
        args.work_item_id as string
      );
      return { success: true };

    // Module handlers
    case "plane_list_modules":
      return client.listModules(
        getWorkspaceSlug(args),
        args.project_id as string
      );

    case "plane_get_module":
      return client.getModule(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.module_id as string
      );

    case "plane_create_module": {
      const input: CreateModuleInput = {
        name: args.name as string,
        description: args.description as string | undefined,
        start_date: args.start_date as string | undefined,
        target_date: args.target_date as string | undefined,
        status: args.status as string | undefined,
        lead: args.lead as string | undefined,
        members: args.members as string[] | undefined,
      };
      return client.createModule(
        getWorkspaceSlug(args),
        args.project_id as string,
        input
      );
    }

    case "plane_update_module": {
      const input: UpdateModuleInput = {};
      if (args.name) input.name = args.name as string;
      if (args.description) input.description = args.description as string;
      if (args.start_date) input.start_date = args.start_date as string;
      if (args.target_date) input.target_date = args.target_date as string;
      if (args.status) input.status = args.status as string;
      return client.updateModule(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.module_id as string,
        input
      );
    }

    case "plane_delete_module":
      await client.deleteModule(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.module_id as string
      );
      return { success: true };

    case "plane_add_work_items_to_module":
      await client.addWorkItemsToModule(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.module_id as string,
        args.work_item_ids as string[]
      );
      return { success: true };

    case "plane_remove_work_item_from_module":
      await client.removeWorkItemFromModule(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.module_id as string,
        args.work_item_id as string
      );
      return { success: true };

    // State handlers
    case "plane_list_states":
      return client.listStates(
        getWorkspaceSlug(args),
        args.project_id as string
      );

    case "plane_create_state": {
      const input: CreateStateInput = {
        name: args.name as string,
        color: args.color as string,
        group: args.group as CreateStateInput["group"],
        sequence: args.sequence as number | undefined,
      };
      return client.createState(
        getWorkspaceSlug(args),
        args.project_id as string,
        input
      );
    }

    case "plane_update_state": {
      const input: UpdateStateInput = {};
      if (args.name) input.name = args.name as string;
      if (args.color) input.color = args.color as string;
      if (args.group) input.group = args.group as UpdateStateInput["group"];
      return client.updateState(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.state_id as string,
        input
      );
    }

    case "plane_delete_state":
      await client.deleteState(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.state_id as string
      );
      return { success: true };

    // Label handlers
    case "plane_list_labels":
      return client.listLabels(
        getWorkspaceSlug(args),
        args.project_id as string
      );

    case "plane_create_label": {
      const input: CreateLabelInput = {
        name: args.name as string,
        color: args.color as string | undefined,
        description: args.description as string | undefined,
      };
      return client.createLabel(
        getWorkspaceSlug(args),
        args.project_id as string,
        input
      );
    }

    case "plane_update_label": {
      const input: UpdateLabelInput = {};
      if (args.name) input.name = args.name as string;
      if (args.color) input.color = args.color as string;
      if (args.description) input.description = args.description as string;
      return client.updateLabel(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.label_id as string,
        input
      );
    }

    case "plane_delete_label":
      await client.deleteLabel(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.label_id as string
      );
      return { success: true };

    // Comment handlers
    case "plane_list_comments":
      return client.listComments(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string
      );

    case "plane_create_comment": {
      const input: CreateCommentInput = {
        comment_html: args.comment_html as string,
      };
      return client.createComment(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        input
      );
    }

    case "plane_update_comment": {
      const input: UpdateCommentInput = {
        comment_html: args.comment_html as string,
      };
      return client.updateComment(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        args.comment_id as string,
        input
      );
    }

    case "plane_delete_comment":
      await client.deleteComment(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        args.comment_id as string
      );
      return { success: true };

    // Link handlers
    case "plane_list_links":
      return client.listLinks(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string
      );

    case "plane_create_link": {
      const input: CreateLinkInput = {
        title: args.title as string,
        url: args.url as string,
      };
      return client.createLink(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        input
      );
    }

    case "plane_delete_link":
      await client.deleteLink(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        args.link_id as string
      );
      return { success: true };

    // Activity handlers
    case "plane_list_activities":
      return client.listActivities(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string
      );

    // Member handlers
    case "plane_list_workspace_members":
      return client.listWorkspaceMembers(getWorkspaceSlug(args));

    case "plane_list_project_members":
      return client.listProjectMembers(
        getWorkspaceSlug(args),
        args.project_id as string
      );

    // User handlers
    case "plane_get_current_user":
      return client.getCurrentUser();

    // Attachment handlers
    case "plane_list_attachments":
      return client.listAttachments(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string
      );

    case "plane_upload_attachment": {
      const fileData = Buffer.from(args.file_base64 as string, "base64");
      return client.uploadAttachment(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        fileData,
        args.filename as string,
        args.mime_type as string
      );
    }

    case "plane_delete_attachment":
      await client.deleteAttachment(
        getWorkspaceSlug(args),
        args.project_id as string,
        args.work_item_id as string,
        args.attachment_id as string
      );
      return { success: true };

    // Watcher handlers
    case "plane_watcher_start": {
      if (watcherInstance?.isRunning()) {
        return {
          success: false,
          message: "Watcher is already running",
          status: watcherInstance.getStatus(),
        };
      }

      if (!FULL_CONFIG?.watch || !FULL_CONFIG?.claude || !FULL_CONFIG?.plane?.project) {
        return {
          success: false,
          message: "Watcher configuration not found. Ensure plane.config.json has 'watch', 'claude', and 'plane.project' sections configured.",
        };
      }

      // Create watcher config from full config
      const watcherConfig: WatcherConfig = {
        plane: {
          baseUrl: FULL_CONFIG.plane.baseUrl,
          apiKey: FULL_CONFIG.plane.apiKey,
          workspace: FULL_CONFIG.plane.workspace,
          project: FULL_CONFIG.plane.project,
        },
        watch: FULL_CONFIG.watch,
        claude: FULL_CONFIG.claude,
      };

      watcherInstance = new PlaneWatcher(watcherConfig);

      // Capture logs
      watcherLogs.length = 0;
      watcherInstance.setLogCallback((msg) => {
        watcherLogs.push(`${new Date().toISOString()} ${msg}`);
        // Keep only last 100 logs
        if (watcherLogs.length > 100) {
          watcherLogs.shift();
        }
        console.error(msg); // Also log to stderr for debugging
      });

      await watcherInstance.start();

      return {
        success: true,
        message: "Watcher started successfully",
        status: watcherInstance.getStatus(),
      };
    }

    case "plane_watcher_stop": {
      if (!watcherInstance?.isRunning()) {
        return {
          success: false,
          message: "Watcher is not running",
        };
      }

      watcherInstance.stop();
      const status = watcherInstance.getStatus();

      return {
        success: true,
        message: "Watcher stopped",
        status,
      };
    }

    case "plane_watcher_status": {
      const includeLogs = args.include_logs !== false;

      if (!watcherInstance) {
        return {
          running: false,
          initialized: false,
          message: "Watcher has not been started",
          logs: includeLogs ? watcherLogs : undefined,
        };
      }

      const status = watcherInstance.getStatus();
      return {
        ...status,
        logs: includeLogs ? watcherLogs.slice(-50) : undefined,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create and start the server
const server = new Server(
  {
    name: "plane-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args as Record<string, unknown>);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Plane MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
