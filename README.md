# ClaudePlane

MCP server and automation watcher for [Plane](https://plane.so) project management.

**Features:**
- MCP server providing 40+ tools for Claude to interact with Plane
- Watcher that automatically triggers Claude when issues are labeled or updated
- Self-hosted Plane support

## Installation

```bash
git clone https://github.com/FishyF1sh/claude-plane.git
cd claude-plane
npm install
npm run build
```

## MCP Server Setup

The MCP server allows Claude Code to read and modify Plane issues, projects, cycles, modules, and more.

### 1. Get your Plane API key

In Plane, go to **Profile Settings → API Tokens** and create a new token.

### 2. Configure Claude Code

Add to your project's MCP configuration in `~/.claude.json`:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "plane": {
          "type": "stdio",
          "command": "node",
          "args": ["/path/to/ClaudePlane/dist/index.js"],
          "env": {
            "PLANE_API_KEY": "plane_api_your_key_here",
            "PLANE_BASE_URL": "https://your-plane-instance.com",
            "PLANE_WORKSPACE_SLUG": "your-workspace"
          }
        }
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLANE_API_KEY` | Yes | Your Plane API token |
| `PLANE_BASE_URL` | Yes | Plane instance URL (e.g., `https://app.plane.so` or self-hosted) |
| `PLANE_WORKSPACE_SLUG` | No | Default workspace (can be overridden per-tool call) |

### Available Tools

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

## Watcher Setup

The watcher monitors Plane for issues with a specific label and automatically triggers Claude to work on them.

### 1. Create a trigger label

In your Plane project, create a label (e.g., "claude") that will trigger automation.

### 2. Create a config file

In your project directory, create `watcher.config.json`:

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

### 3. Run the watcher

```bash
cd /path/to/your/project
node /path/to/ClaudePlane/dist/watcher.js
```

Or with a custom config path:

```bash
node /path/to/ClaudePlane/dist/watcher.js --config ./my-config.json
```

### Trigger Conditions

Configure which events trigger Claude in `watch.triggers`:

| Trigger | Default | Description |
|---------|---------|-------------|
| `onLabelAdded` | `true` | When an item gets the trigger label |
| `onReopened` | `true` | When an item is reopened (moved from Done) |
| `onNewComment` | `true` | When a comment is added to a labeled item |

Example - only trigger on new comments:
```json
"triggers": {
  "onLabelAdded": false,
  "onReopened": false,
  "onNewComment": true
}
```

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

### Example Prompts

```json
// Fix multiple issues
"prompt": "/fix-issue {identifiers}"

// Custom prompt with context
"prompt": "There are {count} issues to fix: {identifiers}\n\nPlease analyze and fix them."

// Review only
"prompt": "Review issue {identifier}: {title}\n\n{description}"
```

## Custom Claude Command

Create `~/.claude/commands/fix-issue.md` to define how Claude should handle issues:

```markdown
# Fix Plane Issue

Fix one or more issues from Plane.

## Arguments
- Issue identifiers (e.g., `TEST-123` or multiple: `TEST-123 TEST-124`)

## Workflow
1. Fetch issue details from Plane
2. Implement the fix
3. Commit changes
4. Add comment to Plane issue with commit link
5. Update issue state to Done
```

## Development

```bash
# Build
npm run build

# Run MCP server directly
npm start

# Run watcher in dev mode
npm run dev:watch
```

## License

MIT
