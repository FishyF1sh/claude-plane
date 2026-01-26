#!/usr/bin/env node
/**
 * Plane Watcher
 * Monitors Plane for work items with a trigger label and spawns Claude to fix them.
 * Can be run standalone or controlled via MCP tools.
 */

import { spawn, ChildProcess } from "child_process";
import { readFileSync, existsSync } from "fs";
import { PlaneClient, WorkItem, State } from "./plane-client.js";

export interface TriggerConditions {
  /** Trigger when an item gets the trigger label (default: true) */
  onLabelAdded?: boolean;
  /** Trigger when an item with the label is reopened (default: true) */
  onReopened?: boolean;
  /** Trigger when a new comment is added to an item with the label (default: true) */
  onNewComment?: boolean;
}

export interface WatcherConfig {
  plane: {
    baseUrl: string;
    apiKey: string;
    workspace: string;
    project: string;
  };
  watch: {
    pollIntervalSeconds: number;
    triggerLabel: string;
    triggers?: TriggerConditions;
  };
  claude: {
    /**
     * Prompt template with placeholders:
     * {identifier} - e.g., PROJ-1
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

export interface WatcherStatus {
  running: boolean;
  initialized: boolean;
  project: string | null;
  triggerLabel: string | null;
  trackedItemCount: number;
  pollIntervalSeconds: number;
  lastPollTime: Date | null;
  currentlyProcessing: string[];
}

interface TrackedItem {
  id: string;
  lastCommentCount: number;
  lastStateId: string;
  processing: boolean;
}

export class PlaneWatcher {
  private config: WatcherConfig;
  private client: PlaneClient;
  private projectId: string | null = null;
  private triggerLabelId: string | null = null;
  private doneStateId: string | null = null;
  private inProgressStateId: string | null = null;
  private trackedItems: Map<string, TrackedItem> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private initialized: boolean = false;
  private lastPollTime: Date | null = null;
  private logCallback: ((message: string) => void) | null = null;

  constructor(config: WatcherConfig) {
    this.config = config;
    this.client = new PlaneClient({
      baseUrl: config.plane.baseUrl,
      apiKey: config.plane.apiKey,
    });
  }

  /** Set a callback for log messages (useful when running via MCP) */
  setLogCallback(callback: (message: string) => void): void {
    this.logCallback = callback;
  }

  private log(message: string): void {
    const formatted = `[Watcher] ${message}`;
    if (this.logCallback) {
      this.logCallback(formatted);
    } else {
      console.log(formatted);
    }
  }

  async initialize(): Promise<void> {
    this.log(`Initializing for project ${this.config.plane.project}...`);

    // Find project by identifier
    const projects = await this.client.listProjects(this.config.plane.workspace);
    const project = projects.results.find(
      (p) => p.identifier === this.config.plane.project
    );
    if (!project) {
      throw new Error(`Project ${this.config.plane.project} not found`);
    }
    this.projectId = project.id;
    this.log(`Found project: ${project.name} (${project.id})`);

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
    this.log(`Found trigger label: ${label.name} (${label.id})`);

    // Find Done and In Progress states
    const states = await this.client.listStates(
      this.config.plane.workspace,
      this.projectId
    );
    const doneState = states.results.find((s) => s.group === "completed");
    const inProgressState = states.results.find((s) => s.group === "started");

    if (doneState) {
      this.doneStateId = doneState.id;
      this.log(`Found Done state: ${doneState.name}`);
    }
    if (inProgressState) {
      this.inProgressStateId = inProgressState.id;
      this.log(`Found In Progress state: ${inProgressState.name}`);
    }

    // Initial scan to populate tracked items
    await this.scanItems(true);

    this.initialized = true;
    this.log(`Initialized. Tracking ${this.trackedItems.size} items with "${this.config.watch.triggerLabel}" label.`);
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
          this.log(`Item ${this.getItemIdentifier(item)} lost trigger label, untracking.`);
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

      // Get trigger conditions with defaults
      const triggers = this.config.watch.triggers || {};
      const onLabelAdded = triggers.onLabelAdded !== false;
      const onReopened = triggers.onReopened !== false;
      const onNewComment = triggers.onNewComment !== false;

      if (!tracked) {
        // New item with trigger label
        this.trackedItems.set(item.id, {
          id: item.id,
          lastCommentCount: commentCount,
          lastStateId: item.state || "",
          processing: false,
        });

        if (!initialScan && onLabelAdded) {
          this.log(`New item with trigger label: ${itemIdentifier}`);
          triggeredItems.push(item);
        }
      } else if (!tracked.processing) {
        // Check for reopened (was Done, now not Done)
        const wasDone = tracked.lastStateId === this.doneStateId;
        const isNotDone = item.state !== this.doneStateId;

        if (wasDone && isNotDone && onReopened) {
          this.log(`Item reopened: ${itemIdentifier}`);
          triggeredItems.push(item);
        }
        // Check for new comments
        else if (commentCount > tracked.lastCommentCount && onNewComment) {
          this.log(`New comment on: ${itemIdentifier} (${commentCount - tracked.lastCommentCount} new)`);
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
    this.log(`Processing ${items.length} item(s): ${identifiers.join(", ")}`);

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
          this.log(`Set ${this.getItemIdentifier(item)} to In Progress`);
        }
      }

      // Spawn Claude with all items
      const prompt = this.buildPrompt(items);
      this.log(`Spawning Claude with prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`);

      await this.spawnClaude(prompt);

      this.log(`Claude finished processing ${identifiers.join(", ")}`);
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

  /** Start the watcher polling loop */
  async start(): Promise<void> {
    if (this.running) {
      this.log("Watcher is already running");
      return;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    this.running = true;
    this.log(`Starting poll loop (every ${this.config.watch.pollIntervalSeconds}s)...`);

    const poll = async () => {
      if (!this.running) return;

      try {
        this.lastPollTime = new Date();
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
    this.pollInterval = setInterval(poll, this.config.watch.pollIntervalSeconds * 1000);
  }

  /** Stop the watcher polling loop */
  stop(): void {
    if (!this.running) {
      this.log("Watcher is not running");
      return;
    }

    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.log("Watcher stopped");
  }

  /** Get current watcher status */
  getStatus(): WatcherStatus {
    const currentlyProcessing: string[] = [];
    for (const [id, tracked] of this.trackedItems) {
      if (tracked.processing) {
        currentlyProcessing.push(id);
      }
    }

    return {
      running: this.running,
      initialized: this.initialized,
      project: this.config.plane.project,
      triggerLabel: this.config.watch.triggerLabel,
      trackedItemCount: this.trackedItems.size,
      pollIntervalSeconds: this.config.watch.pollIntervalSeconds,
      lastPollTime: this.lastPollTime,
      currentlyProcessing,
    };
  }

  /** Check if watcher is running */
  isRunning(): boolean {
    return this.running;
  }
}

export function loadConfig(configPath?: string): WatcherConfig {
  const path = configPath ||
    process.env.PLANE_CONFIG ||
    process.argv.find((arg, i) => process.argv[i - 1] === "--config") ||
    "./plane.config.json";

  if (!existsSync(path)) {
    console.error(`Config file not found: ${path}`);
    console.error("\nCreate a plane.config.json with:");
    console.error(`{
  "plane": {
    "baseUrl": "https://your-plane-instance.com",
    "apiKey": "plane_api_...",
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

Trigger conditions (all default to true):
  onLabelAdded  - when an item gets the trigger label
  onReopened    - when an item is reopened (moved from Done)
  onNewComment  - when a comment is added to a labeled item

Available placeholders in prompt:
  Batch (all triggered items):
    {identifiers} - space-separated, e.g., "PROJ-1 PROJ-2"
    {ids}         - space-separated UUIDs
    {urls}        - newline-separated URLs
    {count}       - number of items

  Single (first item, for backwards compat):
    {identifier}  - e.g., PROJ-1
    {id}          - UUID of work item
    {title}       - issue title
    {description} - issue description (HTML stripped)
    {url}         - link to issue in Plane UI
    {project}     - project identifier
    {sequence_id} - just the number`);
    throw new Error(`Config file not found: ${path}`);
  }

  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as WatcherConfig;
}

// Only run main when executed directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  async function main() {
    console.log("=================================");
    console.log("  Plane Watcher for Claude Code");
    console.log("=================================\n");

    const config = loadConfig();
    const watcher = new PlaneWatcher(config);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\nReceived SIGINT, stopping watcher...");
      watcher.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\nReceived SIGTERM, stopping watcher...");
      watcher.stop();
      process.exit(0);
    });

    await watcher.initialize();
    console.log("[Watcher] Press Ctrl+C to stop.\n");
    await watcher.start();
  }

  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
