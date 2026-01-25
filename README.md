# ClaudePlane

MCP server and automation watcher for [Plane](https://plane.so) project management.

**Features:**
- MCP server providing 40+ tools for Claude to interact with Plane
- Watcher that automatically triggers Claude when issues are labeled or updated
- Self-hosted Plane support
- Single config file for both MCP and watcher

## Installation

```bash
git clone https://github.com/FishyF1sh/claude-plane.git
cd claude-plane
npm install
npm run build
```

## Quick Start

### 1. Create config file

In your project directory, create `plane.config.json`:

```json
{
  "plane": {
    "baseUrl": "https://your-plane-instance.com",
    "apiKey": "plane_api_your-api-key",
    "workspace": "your-workspace",
    "project": "your-project"
  },
  "watch": {
    "pollIntervalSeconds": 30,
    "triggerLabel": "claude",
    "triggers": {
      "onLabelAdded": true,
      "onReopened": true,
      "onNewComment": true
    }
  },
  "claude": {
    "prompt": "/fix-issue {identifiers}"
  }
}
```

### 2. Configure Claude Code

Add to `~/.claude.json`:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "plane": {
          "type": "stdio",
          "command": "node",
          "args": ["/path/to/claude-plane/dist/index.js"],
          "env": {
            "PLANE_CONFIG": "/path/to/your/project/plane.config.json"
          }
        }
      }
    }
  }
}
```

### 3. Run the watcher (optional)

```bash
cd /path/to/your/project
node /path/to/claude-plane/dist/watcher.js
```

That's it! Claude can now interact with Plane, and the watcher will auto-trigger Claude on labeled issues.

---

## Configuration Reference

### plane.config.json

```json
{
  "plane": {
    "baseUrl": "https://your-plane-instance.com",
    "apiKey": "plane_api_your-api-key",
    "workspace": "your-workspace",
    "project": "your-project"
  },
  "watch": {
    "pollIntervalSeconds": 30,
    "triggerLabel": "claude",
    "triggers": {
      "onLabelAdded": true,
      "onReopened": true,
      "onNewComment": true
    }
  },
  "claude": {
    "prompt": "/fix-issue {identifiers}"
  }
}
```

| Section | Field | Description |
|---------|-------|-------------|
| `plane` | `baseUrl` | Plane instance URL |
| `plane` | `apiKey` | API token from Plane settings |
| `plane` | `workspace` | Workspace slug (from URL) |
| `plane` | `project` | Project identifier (e.g., "PROJ") - only needed for watcher |
| `watch` | `pollIntervalSeconds` | How often to check for updates |
| `watch` | `triggerLabel` | Label that triggers Claude |
| `watch` | `triggers` | Which events trigger Claude (see below) |
| `claude` | `prompt` | Prompt template with placeholders |

### Trigger Conditions

| Trigger | Default | Description |
|---------|---------|-------------|
| `onLabelAdded` | `true` | When an item gets the trigger label |
| `onReopened` | `true` | When an item is reopened (moved from Done) |
| `onNewComment` | `true` | When a comment is added to a labeled item |

### Prompt Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{identifiers}` | Space-separated issue IDs | `PROJ-1 PROJ-2` |
| `{ids}` | Space-separated UUIDs | `uuid1 uuid2` |
| `{urls}` | Newline-separated URLs | |
| `{count}` | Number of triggered items | `3` |
| `{identifier}` | First issue ID | `PROJ-1` |
| `{id}` | First issue UUID | |
| `{title}` | First issue title | |
| `{description}` | First issue description | |
| `{url}` | First issue URL | |
| `{project}` | Project identifier | `PROJ` |
| `{sequence_id}` | First issue number | `1` |

---

## Available MCP Tools

**Projects:** `plane_list_projects`, `plane_get_project`, `plane_create_project`, `plane_update_project`, `plane_delete_project`

**Work Items:** `plane_list_work_items`, `plane_get_work_item`, `plane_create_work_item`, `plane_update_work_item`, `plane_delete_work_item`

**Cycles:** `plane_list_cycles`, `plane_get_cycle`, `plane_create_cycle`, `plane_update_cycle`, `plane_delete_cycle`, `plane_add_work_items_to_cycle`, `plane_remove_work_item_from_cycle`

**Modules:** `plane_list_modules`, `plane_get_module`, `plane_create_module`, `plane_update_module`, `plane_delete_module`, `plane_add_work_items_to_module`, `plane_remove_work_item_from_module`

**States:** `plane_list_states`, `plane_create_state`, `plane_update_state`, `plane_delete_state`

**Labels:** `plane_list_labels`, `plane_create_label`, `plane_update_label`, `plane_delete_label`

**Comments:** `plane_list_comments`, `plane_create_comment`, `plane_update_comment`, `plane_delete_comment`

**Links:** `plane_list_links`, `plane_create_link`, `plane_delete_link`

**Activities:** `plane_list_activities`

**Members:** `plane_list_workspace_members`, `plane_list_project_members`

**Attachments:** `plane_list_attachments`, `plane_upload_attachment`, `plane_delete_attachment`

**User:** `plane_get_current_user`

---

## Custom Claude Command

Create `~/.claude/commands/fix-issue.md` to define how Claude handles issues:

```markdown
# Fix Plane Issue

## Arguments
- Issue identifiers (e.g., `PROJ-123` or multiple: `PROJ-123 PROJ-124`)

## Workflow
1. Fetch issue details from Plane
2. Implement the fix
3. Commit changes
4. Add comment to Plane issue with commit link
5. Update issue state to Done
```

---

## Backwards Compatibility

The MCP server also supports environment variables instead of a config file:

```json
{
  "env": {
    "PLANE_API_KEY": "plane_api_...",
    "PLANE_BASE_URL": "https://...",
    "PLANE_WORKSPACE_SLUG": "your-workspace"
  }
}
```

---

## Development

```bash
npm run build        # Build
npm start            # Run MCP server
npm run watch        # Run watcher
npm run dev          # Dev mode (MCP)
npm run dev:watch    # Dev mode (watcher)
```

## License

MIT
