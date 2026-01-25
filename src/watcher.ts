#!/usr/bin/env node
/**
 * Plane Watcher
 * Monitors Plane for work items with a trigger label and spawns Claude to fix them.
 */

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { PlaneClient, WorkItem, State } from "./plane-client.js";

interface WatcherConfig {
  plane: {
    baseUrl: string;
    apiKey: string;
    workspace: string;
    project: string;
  };
  watch: {
    pollIntervalSeconds: number;
    triggerLabel: string;
  };
  claude: {
    /**
     * Prompt template with placeholders:
     * {identifier} - e.g., SPICYMOCKS-1
     * {id} - UUID of work item
     * {title} - issue title
     * {description} - issue description (HTML tags stripped)
     * {url} - link to issue in Plane UI
     * {project} - project identifier
     * {sequence_id} - just the number
     */
    prompt: string;
  };
}

interface TrackedItem {
  id: string;
  lastCommentCount: number;
  lastStateId: string;
  processing: boolean;
}

class PlaneWatcher {
  private config: WatcherConfig;
  private client: PlaneClient;
  private projectId: string | null = null;
  private triggerLabelId: string | null = null;
  private doneStateId: string | null = null;
  private inProgressStateId: string | null = null;
  private trackedItems: Map<string, TrackedItem> = new Map();

  constructor(config: WatcherConfig) {
    this.config = config;
    this.client = new PlaneClient({
      baseUrl: config.plane.baseUrl,
      apiKey: config.plane.apiKey,
    });
  }

  async initialize(): Promise<void> {
    console.log(`[Watcher] Initializing for project ${this.config.plane.project}...`);

    // Find project by identifier
    const projects = await this.client.listProjects(this.config.plane.workspace);
    const project = projects.results.find(
      (p) => p.identifier === this.config.plane.project
    );
    if (!project) {
      throw new Error(`Project ${this.config.plane.project} not found`);
    }
    this.projectId = project.id;
    console.log(`[Watcher] Found project: ${project.name} (${project.id})`);

    // Find trigger label
    const labels = await this.client.listLabels(
      this.config.plane.workspace,
      this.projectId
    );
    const label = labels.results.find(
      (l) => l.name.toLowerCase() === this.config.watch.triggerLabel.toLowerCase()
    );
    if (!label) {
      throw new Error(
        `Label "${this.config.watch.triggerLabel}" not found in project. Please create it.`
      );
    }
    this.triggerLabelId = label.id;
    console.log(`[Watcher] Found trigger label: ${label.name} (${label.id})`);

    // Find Done and In Progress states
    const states = await this.client.listStates(
      this.config.plane.workspace,
      this.projectId
    );
    const doneState = states.results.find((s) => s.group === "completed");
    const inProgressState = states.results.find((s) => s.group === "started");

    if (doneState) {
      this.doneStateId = doneState.id;
      console.log(`[Watcher] Found Done state: ${doneState.name}`);
    }
    if (inProgressState) {
      this.inProgressStateId = inProgressState.id;
      console.log(`[Watcher] Found In Progress state: ${inProgressState.name}`);
    }

    // Initial scan to populate tracked items
    await this.scanItems(true);

    console.log(`[Watcher] Initialized. Tracking ${this.trackedItems.size} items with "${this.config.watch.triggerLabel}" label.`);
  }

  private async scanItems(initialScan: boolean = false): Promise<WorkItem[]> {
    const triggeredItems: WorkItem[] = [];

    const workItems = await this.client.listWorkItems(
      this.config.plane.workspace,
      this.projectId!,
      { per_page: 100 }
    );

    for (const item of workItems.results) {
      // Only process items with trigger label
      if (!item.labels?.includes(this.triggerLabelId!)) {
        // If item lost the label, stop tracking it
        if (this.trackedItems.has(item.id)) {
          console.log(`[Watcher] Item ${this.getItemIdentifier(item)} lost trigger label, untracking.`);
          this.trackedItems.delete(item.id);
        }
        continue;
      }

      // Get comment count for this item
      const comments = await this.client.listComments(
        this.config.plane.workspace,
        this.projectId!,
        item.id
      );
      const commentCount = comments.results.length;

      const tracked = this.trackedItems.get(item.id);
      const itemIdentifier = this.getItemIdentifier(item);

      if (!tracked) {
        // New item with trigger label
        this.trackedItems.set(item.id, {
          id: item.id,
          lastCommentCount: commentCount,
          lastStateId: item.state || "",
          processing: false,
        });

        if (!initialScan) {
          console.log(`[Watcher] New item with trigger label: ${itemIdentifier}`);
          triggeredItems.push(item);
        }
      } else if (!tracked.processing) {
        // Check for reopened (was Done, now not Done)
        const wasDone = tracked.lastStateId === this.doneStateId;
        const isNotDone = item.state !== this.doneStateId;

        if (wasDone && isNotDone) {
          console.log(`[Watcher] Item reopened: ${itemIdentifier}`);
          triggeredItems.push(item);
        }
        // Check for new comments
        else if (commentCount > tracked.lastCommentCount) {
          console.log(`[Watcher] New comment on: ${itemIdentifier} (${commentCount - tracked.lastCommentCount} new)`);
          triggeredItems.push(item);
        }

        // Update tracked state
        tracked.lastCommentCount = commentCount;
        tracked.lastStateId = item.state || "";
      }
    }

    return triggeredItems;
  }

  private getItemIdentifier(item: WorkItem): string {
    return `${this.config.plane.project}-${item.sequence_id}`;
  }

  private getItemUrl(item: WorkItem): string {
    return `${this.config.plane.baseUrl}/${this.config.plane.workspace}/projects/${this.projectId}/issues/${item.id}`;
  }

  private stripHtml(html: string | undefined): string {
    if (!html) return "";
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  private buildPrompt(items: WorkItem[]): string {
    if (items.length === 0) return "";

    // For batch placeholders (multiple items)
    const identifiers = items.map((item) => this.getItemIdentifier(item)).join(" ");
    const ids = items.map((item) => item.id).join(" ");
    const urls = items.map((item) => this.getItemUrl(item)).join("\n");

    // For single-item placeholders, use first item (for backwards compat)
    const item = items[0];

    const replacements: Record<string, string> = {
      // Batch placeholders (all items)
      "{identifiers}": identifiers,
      "{ids}": ids,
      "{urls}": urls,
      "{count}": String(items.length),
      // Single-item placeholders (first item, for backwards compat)
      "{identifier}": this.getItemIdentifier(item),
      "{id}": item.id,
      "{title}": item.name,
      "{description}": this.stripHtml(item.description_html),
      "{url}": this.getItemUrl(item),
      "{project}": this.config.plane.project,
      "{sequence_id}": String(item.sequence_id || ""),
    };

    let prompt = this.config.claude.prompt;
    for (const [placeholder, value] of Object.entries(replacements)) {
      prompt = prompt.split(placeholder).join(value);
    }
    return prompt;
  }

  private async processItems(items: WorkItem[]): Promise<void> {
    if (items.length === 0) return;

    const identifiers = items.map((item) => this.getItemIdentifier(item));
    console.log(`[Watcher] Processing ${items.length} item(s): ${identifiers.join(", ")}`);

    // Mark all as processing
    for (const item of items) {
      const tracked = this.trackedItems.get(item.id);
      if (tracked) tracked.processing = true;
    }

    try {
      // Set all to In Progress
      for (const item of items) {
        if (this.inProgressStateId && item.state !== this.inProgressStateId) {
          await this.client.updateWorkItem(
            this.config.plane.workspace,
            this.projectId!,
            item.id,
            { state: this.inProgressStateId }
          );
          console.log(`[Watcher] Set ${this.getItemIdentifier(item)} to In Progress`);
        }
      }

      // Spawn Claude with all items
      const prompt = this.buildPrompt(items);
      console.log(`[Watcher] Spawning Claude with prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`);

      await this.spawnClaude(prompt);

      console.log(`[Watcher] Claude finished processing ${identifiers.join(", ")}`);
    } catch (error) {
      console.error(`[Watcher] Error processing items:`, error);
    } finally {
      // Update tracking for all items
      for (const item of items) {
        const tracked = this.trackedItems.get(item.id);
        if (!tracked) continue;

        tracked.processing = false;

        try {
          const comments = await this.client.listComments(
            this.config.plane.workspace,
            this.projectId!,
            item.id
          );
          tracked.lastCommentCount = comments.results.length;

          const updatedItem = await this.client.getWorkItem(
            this.config.plane.workspace,
            this.projectId!,
            item.id
          );
          tracked.lastStateId = updatedItem.state || "";
        } catch (e) {
          console.error(`[Watcher] Error updating tracking for ${this.getItemIdentifier(item)}:`, e);
        }
      }
    }
  }

  private spawnClaude(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const claude = spawn("claude", ["--dangerously-skip-permissions", "-p", command], {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
      });

      claude.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude exited with code ${code}`));
        }
      });

      claude.on("error", (err) => {
        reject(err);
      });
    });
  }

  async start(): Promise<void> {
    console.log(`[Watcher] Starting poll loop (every ${this.config.watch.pollIntervalSeconds}s)...`);
    console.log(`[Watcher] Press Ctrl+C to stop.\n`);

    const poll = async () => {
      try {
        const triggeredItems = await this.scanItems();

        if (triggeredItems.length > 0) {
          await this.processItems(triggeredItems);
        }
      } catch (error) {
        console.error("[Watcher] Poll error:", error);
      }
    };

    // Initial poll
    await poll();

    // Schedule recurring polls
    setInterval(poll, this.config.watch.pollIntervalSeconds * 1000);
  }
}

function loadConfig(): WatcherConfig {
  const configPath = process.env.WATCHER_CONFIG ||
    process.argv.find((arg, i) => process.argv[i - 1] === "--config") ||
    "./watcher.config.json";

  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error("\nCreate a watcher.config.json with:");
    console.error(`{
  "plane": {
    "baseUrl": "https://your-plane-instance.com",
    "apiKey": "plane_api_...",
    "workspace": "your-workspace",
    "project": "YOUR_PROJECT"
  },
  "watch": {
    "pollIntervalSeconds": 30,
    "triggerLabel": "claude"
  },
  "claude": {
    "prompt": "/fix-issue {identifier}"
  }
}

Available placeholders in prompt:
  Batch (all triggered items):
    {identifiers} - space-separated, e.g., "SPICYMOCKS-1 SPICYMOCKS-2"
    {ids}         - space-separated UUIDs
    {urls}        - newline-separated URLs
    {count}       - number of items

  Single (first item, for backwards compat):
    {identifier}  - e.g., SPICYMOCKS-1
    {id}          - UUID of work item
    {title}       - issue title
    {description} - issue description (HTML stripped)
    {url}         - link to issue in Plane UI
    {project}     - project identifier
    {sequence_id} - just the number`);
    process.exit(1);
  }

  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content) as WatcherConfig;
}

async function main() {
  console.log("=================================");
  console.log("  Plane Watcher for Claude Code");
  console.log("=================================\n");

  const config = loadConfig();
  const watcher = new PlaneWatcher(config);

  await watcher.initialize();
  await watcher.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
