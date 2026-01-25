/**
 * Plane API Client
 * Handles all communication with the Plane REST API
 */

export interface PlaneConfig {
  baseUrl: string;
  apiKey: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  next_cursor?: string;
  prev_cursor?: string;
  total_results?: number;
}

// Work Item / Issue types
export interface WorkItem {
  id: string;
  name: string;
  description_html?: string;
  description_stripped?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  state?: string;
  state_detail?: State;
  assignees?: string[];
  labels?: string[];
  start_date?: string;
  target_date?: string;
  sequence_id?: number;
  project?: string;
  parent?: string;
  cycle?: string;
  module?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  estimate_point?: number;
}

export interface CreateWorkItemInput {
  name: string;
  description_html?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  state?: string;
  assignees?: string[];
  labels?: string[];
  start_date?: string;
  target_date?: string;
  parent?: string;
  estimate_point?: number;
}

export interface UpdateWorkItemInput {
  name?: string;
  description_html?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  state?: string;
  assignees?: string[];
  labels?: string[];
  start_date?: string;
  target_date?: string;
  parent?: string;
  estimate_point?: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  identifier: string;
  network?: number;
  emoji?: string;
  icon_prop?: Record<string, unknown>;
  module_view?: boolean;
  cycle_view?: boolean;
  issue_views_view?: boolean;
  page_view?: boolean;
  inbox_view?: boolean;
  cover_image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProjectInput {
  name: string;
  identifier: string;
  description?: string;
  network?: number;
  emoji?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  network?: number;
  emoji?: string;
}

// Cycle types
export interface Cycle {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  owned_by?: string;
  project?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCycleInput {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateCycleInput {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

// Module types
export interface Module {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  target_date?: string;
  status?: string;
  lead?: string;
  members?: string[];
  project?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateModuleInput {
  name: string;
  description?: string;
  start_date?: string;
  target_date?: string;
  status?: string;
  lead?: string;
  members?: string[];
}

export interface UpdateModuleInput {
  name?: string;
  description?: string;
  start_date?: string;
  target_date?: string;
  status?: string;
  lead?: string;
  members?: string[];
}

// State types
export interface State {
  id: string;
  name: string;
  color: string;
  group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
  sequence?: number;
  project?: string;
  default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateStateInput {
  name: string;
  color: string;
  group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
  sequence?: number;
}

export interface UpdateStateInput {
  name?: string;
  color?: string;
  group?: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
  sequence?: number;
}

// Label types
export interface Label {
  id: string;
  name: string;
  color?: string;
  description?: string;
  parent?: string;
  project?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLabelInput {
  name: string;
  color?: string;
  description?: string;
  parent?: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  description?: string;
  parent?: string;
}

// Comment types
export interface Comment {
  id: string;
  comment_html: string;
  comment_stripped?: string;
  actor?: string;
  issue?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCommentInput {
  comment_html: string;
}

export interface UpdateCommentInput {
  comment_html: string;
}

// Member types
export interface Member {
  id: string;
  member: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    avatar?: string;
  };
  role?: number;
  created_at?: string;
}

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  created_at?: string;
  updated_at?: string;
}

// Link types
export interface Link {
  id: string;
  title: string;
  url: string;
  issue?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLinkInput {
  title: string;
  url: string;
}

export interface UpdateLinkInput {
  title?: string;
  url?: string;
}

// Activity types
export interface Activity {
  id: string;
  verb: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  actor?: string;
  issue?: string;
  created_at?: string;
}

// Worklog types
export interface Worklog {
  id: string;
  description?: string;
  duration: number; // in minutes
  logged_at?: string;
  actor?: string;
  issue?: string;
  project?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorklogInput {
  description?: string;
  duration: number; // in minutes
  logged_at?: string;
}

export interface UpdateWorklogInput {
  description?: string;
  duration?: number;
}

// Epic types
export interface Epic {
  id: string;
  name: string;
  description?: string;
  description_html?: string;
  start_date?: string;
  target_date?: string;
  project?: string;
  state?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  created_at?: string;
  updated_at?: string;
}

// Initiative types
export interface Initiative {
  id: string;
  name: string;
  description?: string;
  description_html?: string;
  start_date?: string;
  target_date?: string;
  workspace?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateInitiativeInput {
  name: string;
  description?: string;
  description_html?: string;
  start_date?: string;
  target_date?: string;
}

export interface UpdateInitiativeInput {
  name?: string;
  description?: string;
  description_html?: string;
  start_date?: string;
  target_date?: string;
}

// Attachment types
export interface AttachmentCredentials {
  upload_data: {
    url: string;
    fields: Record<string, string>;
  };
  asset_id: string;
  attachment: Attachment;
  asset_url: string;
}

export interface Attachment {
  id: string;
  asset: string;
  attributes: {
    name: string;
    size: number;
    type: string;
  };
  issue?: string;
  project?: string;
  created_at?: string;
  updated_at?: string;
}

export class PlaneClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: PlaneConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Plane API error (${response.status}): ${errorText}`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Workspace methods
  async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>("GET", "/api/v1/workspaces/");
  }

  async getWorkspace(workspaceSlug: string): Promise<Workspace> {
    return this.request<Workspace>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/`
    );
  }

  // Project methods
  async listProjects(workspaceSlug: string): Promise<PaginatedResponse<Project>> {
    return this.request<PaginatedResponse<Project>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/`
    );
  }

  async getProject(workspaceSlug: string, projectId: string): Promise<Project> {
    return this.request<Project>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/`
    );
  }

  async createProject(
    workspaceSlug: string,
    input: CreateProjectInput
  ): Promise<Project> {
    return this.request<Project>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/`,
      input
    );
  }

  async updateProject(
    workspaceSlug: string,
    projectId: string,
    input: UpdateProjectInput
  ): Promise<Project> {
    return this.request<Project>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/`,
      input
    );
  }

  async deleteProject(workspaceSlug: string, projectId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/`
    );
  }

  // Work Item methods
  async listWorkItems(
    workspaceSlug: string,
    projectId: string,
    options?: { cursor?: string; per_page?: number; expand?: string }
  ): Promise<PaginatedResponse<WorkItem>> {
    let path = `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/`;
    const params = new URLSearchParams();
    if (options?.cursor) params.append("cursor", options.cursor);
    if (options?.per_page) params.append("per_page", options.per_page.toString());
    if (options?.expand) params.append("expand", options.expand);
    if (params.toString()) path += `?${params.toString()}`;
    return this.request<PaginatedResponse<WorkItem>>("GET", path);
  }

  async getWorkItem(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<WorkItem> {
    return this.request<WorkItem>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`
    );
  }

  async getWorkItemByIdentifier(
    workspaceSlug: string,
    identifier: string
  ): Promise<WorkItem> {
    return this.request<WorkItem>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/work-items/${identifier}/`
    );
  }

  async searchWorkItems(
    workspaceSlug: string,
    query: string
  ): Promise<WorkItem[]> {
    return this.request<WorkItem[]>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/work-items/search/?query=${encodeURIComponent(query)}`
    );
  }

  async createWorkItem(
    workspaceSlug: string,
    projectId: string,
    input: CreateWorkItemInput
  ): Promise<WorkItem> {
    return this.request<WorkItem>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/`,
      input
    );
  }

  async updateWorkItem(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    input: UpdateWorkItemInput
  ): Promise<WorkItem> {
    return this.request<WorkItem>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`,
      input
    );
  }

  async deleteWorkItem(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`
    );
  }

  // Cycle methods
  async listCycles(
    workspaceSlug: string,
    projectId: string
  ): Promise<PaginatedResponse<Cycle>> {
    return this.request<PaginatedResponse<Cycle>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/`
    );
  }

  async getCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<Cycle> {
    return this.request<Cycle>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/`
    );
  }

  async createCycle(
    workspaceSlug: string,
    projectId: string,
    input: CreateCycleInput
  ): Promise<Cycle> {
    return this.request<Cycle>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/`,
      input
    );
  }

  async updateCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    input: UpdateCycleInput
  ): Promise<Cycle> {
    return this.request<Cycle>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/`,
      input
    );
  }

  async deleteCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/`
    );
  }

  async addWorkItemsToCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    workItemIds: string[]
  ): Promise<void> {
    await this.request<void>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/cycle-issues/`,
      { issues: workItemIds }
    );
  }

  async removeWorkItemFromCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    workItemId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/cycle-issues/${workItemId}/`
    );
  }

  // Module methods
  async listModules(
    workspaceSlug: string,
    projectId: string
  ): Promise<PaginatedResponse<Module>> {
    return this.request<PaginatedResponse<Module>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/`
    );
  }

  async getModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string
  ): Promise<Module> {
    return this.request<Module>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/`
    );
  }

  async createModule(
    workspaceSlug: string,
    projectId: string,
    input: CreateModuleInput
  ): Promise<Module> {
    return this.request<Module>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/`,
      input
    );
  }

  async updateModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    input: UpdateModuleInput
  ): Promise<Module> {
    return this.request<Module>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/`,
      input
    );
  }

  async deleteModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/`
    );
  }

  async addWorkItemsToModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    workItemIds: string[]
  ): Promise<void> {
    await this.request<void>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/module-issues/`,
      { issues: workItemIds }
    );
  }

  async removeWorkItemFromModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    workItemId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/module-issues/${workItemId}/`
    );
  }

  // State methods
  async listStates(
    workspaceSlug: string,
    projectId: string
  ): Promise<PaginatedResponse<State>> {
    return this.request<PaginatedResponse<State>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/`
    );
  }

  async getState(
    workspaceSlug: string,
    projectId: string,
    stateId: string
  ): Promise<State> {
    return this.request<State>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/${stateId}/`
    );
  }

  async createState(
    workspaceSlug: string,
    projectId: string,
    input: CreateStateInput
  ): Promise<State> {
    return this.request<State>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/`,
      input
    );
  }

  async updateState(
    workspaceSlug: string,
    projectId: string,
    stateId: string,
    input: UpdateStateInput
  ): Promise<State> {
    return this.request<State>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/${stateId}/`,
      input
    );
  }

  async deleteState(
    workspaceSlug: string,
    projectId: string,
    stateId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/${stateId}/`
    );
  }

  // Label methods
  async listLabels(
    workspaceSlug: string,
    projectId: string
  ): Promise<PaginatedResponse<Label>> {
    return this.request<PaginatedResponse<Label>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/labels/`
    );
  }

  async getLabel(
    workspaceSlug: string,
    projectId: string,
    labelId: string
  ): Promise<Label> {
    return this.request<Label>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/labels/${labelId}/`
    );
  }

  async createLabel(
    workspaceSlug: string,
    projectId: string,
    input: CreateLabelInput
  ): Promise<Label> {
    return this.request<Label>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/labels/`,
      input
    );
  }

  async updateLabel(
    workspaceSlug: string,
    projectId: string,
    labelId: string,
    input: UpdateLabelInput
  ): Promise<Label> {
    return this.request<Label>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/labels/${labelId}/`,
      input
    );
  }

  async deleteLabel(
    workspaceSlug: string,
    projectId: string,
    labelId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/labels/${labelId}/`
    );
  }

  // Comment methods
  async listComments(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<PaginatedResponse<Comment>> {
    return this.request<PaginatedResponse<Comment>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/comments/`
    );
  }

  async getComment(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    commentId: string
  ): Promise<Comment> {
    return this.request<Comment>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/comments/${commentId}/`
    );
  }

  async createComment(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    input: CreateCommentInput
  ): Promise<Comment> {
    return this.request<Comment>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/comments/`,
      input
    );
  }

  async updateComment(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    commentId: string,
    input: UpdateCommentInput
  ): Promise<Comment> {
    return this.request<Comment>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/comments/${commentId}/`,
      input
    );
  }

  async deleteComment(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    commentId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/comments/${commentId}/`
    );
  }

  // Link methods
  async listLinks(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<PaginatedResponse<Link>> {
    return this.request<PaginatedResponse<Link>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/links/`
    );
  }

  async createLink(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    input: CreateLinkInput
  ): Promise<Link> {
    return this.request<Link>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/links/`,
      input
    );
  }

  async updateLink(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    linkId: string,
    input: UpdateLinkInput
  ): Promise<Link> {
    return this.request<Link>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/links/${linkId}/`,
      input
    );
  }

  async deleteLink(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    linkId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/links/${linkId}/`
    );
  }

  // Activity methods
  async listActivities(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<PaginatedResponse<Activity>> {
    return this.request<PaginatedResponse<Activity>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/activities/`
    );
  }

  // Member methods
  async listWorkspaceMembers(
    workspaceSlug: string
  ): Promise<PaginatedResponse<Member>> {
    return this.request<PaginatedResponse<Member>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/members/`
    );
  }

  async listProjectMembers(
    workspaceSlug: string,
    projectId: string
  ): Promise<PaginatedResponse<Member>> {
    return this.request<PaginatedResponse<Member>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/members/`
    );
  }

  // User methods
  async getCurrentUser(): Promise<{ id: string; email: string; first_name?: string; last_name?: string }> {
    return this.request<{ id: string; email: string; first_name?: string; last_name?: string }>(
      "GET",
      "/api/v1/users/me/"
    );
  }

  // Worklog methods
  async listWorklogs(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<PaginatedResponse<Worklog>> {
    return this.request<PaginatedResponse<Worklog>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/worklogs/`
    );
  }

  async getWorklog(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    worklogId: string
  ): Promise<Worklog> {
    return this.request<Worklog>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/worklogs/${worklogId}/`
    );
  }

  async createWorklog(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    input: CreateWorklogInput
  ): Promise<Worklog> {
    return this.request<Worklog>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/worklogs/`,
      input
    );
  }

  async updateWorklog(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    worklogId: string,
    input: UpdateWorklogInput
  ): Promise<Worklog> {
    return this.request<Worklog>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/worklogs/${worklogId}/`,
      input
    );
  }

  async deleteWorklog(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    worklogId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/worklogs/${worklogId}/`
    );
  }

  async getTotalWorklogTime(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<{ total_duration: number }> {
    return this.request<{ total_duration: number }>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/worklogs/total/`
    );
  }

  // Epic methods
  async listEpics(
    workspaceSlug: string,
    projectId: string
  ): Promise<PaginatedResponse<Epic>> {
    return this.request<PaginatedResponse<Epic>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/epics/`
    );
  }

  async getEpic(
    workspaceSlug: string,
    projectId: string,
    epicId: string
  ): Promise<Epic> {
    return this.request<Epic>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/epics/${epicId}/`
    );
  }

  // Initiative methods
  async listInitiatives(
    workspaceSlug: string
  ): Promise<PaginatedResponse<Initiative>> {
    return this.request<PaginatedResponse<Initiative>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/`
    );
  }

  async getInitiative(
    workspaceSlug: string,
    initiativeId: string
  ): Promise<Initiative> {
    return this.request<Initiative>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/`
    );
  }

  async createInitiative(
    workspaceSlug: string,
    input: CreateInitiativeInput
  ): Promise<Initiative> {
    return this.request<Initiative>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/`,
      input
    );
  }

  async updateInitiative(
    workspaceSlug: string,
    initiativeId: string,
    input: UpdateInitiativeInput
  ): Promise<Initiative> {
    return this.request<Initiative>(
      "PATCH",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/`,
      input
    );
  }

  async deleteInitiative(
    workspaceSlug: string,
    initiativeId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/`
    );
  }

  async addEpicsToInitiative(
    workspaceSlug: string,
    initiativeId: string,
    epicIds: string[]
  ): Promise<void> {
    await this.request<void>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/epics/`,
      { epics: epicIds }
    );
  }

  async removeEpicFromInitiative(
    workspaceSlug: string,
    initiativeId: string,
    epicId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/epics/${epicId}/`
    );
  }

  async listInitiativeEpics(
    workspaceSlug: string,
    initiativeId: string
  ): Promise<PaginatedResponse<Epic>> {
    return this.request<PaginatedResponse<Epic>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/epics/`
    );
  }

  async addProjectsToInitiative(
    workspaceSlug: string,
    initiativeId: string,
    projectIds: string[]
  ): Promise<void> {
    await this.request<void>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/projects/`,
      { projects: projectIds }
    );
  }

  async removeProjectFromInitiative(
    workspaceSlug: string,
    initiativeId: string,
    projectId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/projects/${projectId}/`
    );
  }

  async listInitiativeProjects(
    workspaceSlug: string,
    initiativeId: string
  ): Promise<PaginatedResponse<Project>> {
    return this.request<PaginatedResponse<Project>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/initiatives/${initiativeId}/projects/`
    );
  }

  // Attachment methods
  async getAttachmentUploadCredentials(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    filename: string,
    fileSize: number,
    mimeType: string
  ): Promise<AttachmentCredentials> {
    return this.request<AttachmentCredentials>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/attachments/`,
      {
        name: filename,
        size: fileSize,
        type: mimeType,
      }
    );
  }

  async uploadAttachmentToS3(
    uploadUrl: string,
    fields: Record<string, string>,
    fileData: Buffer,
    filename: string,
    mimeType: string
  ): Promise<void> {
    const formData = new FormData();

    // Add all presigned fields
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }

    // Add the file - convert Buffer to Uint8Array for Blob compatibility
    const uint8Array = new Uint8Array(fileData);
    const blob = new Blob([uint8Array], { type: mimeType });
    formData.append("file", blob, filename);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status}`);
    }
  }

  async completeAttachmentUpload(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    assetId: string
  ): Promise<Attachment> {
    return this.request<Attachment>(
      "POST",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/attachments/${assetId}/complete/`
    );
  }

  async listAttachments(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<PaginatedResponse<Attachment>> {
    return this.request<PaginatedResponse<Attachment>>(
      "GET",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/attachments/`
    );
  }

  async deleteAttachment(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    attachmentId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/attachments/${attachmentId}/`
    );
  }

  // Helper method to upload a file as attachment (combines all steps)
  async uploadAttachment(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    fileData: Buffer,
    filename: string,
    mimeType: string
  ): Promise<Attachment> {
    // Step 1: Get upload credentials
    const credentials = await this.getAttachmentUploadCredentials(
      workspaceSlug,
      projectId,
      workItemId,
      filename,
      fileData.length,
      mimeType
    );

    // Step 2: Upload to S3
    await this.uploadAttachmentToS3(
      credentials.upload_data.url,
      credentials.upload_data.fields,
      fileData,
      filename,
      mimeType
    );

    // Step 3: Complete the upload
    return this.completeAttachmentUpload(
      workspaceSlug,
      projectId,
      workItemId,
      credentials.asset_id
    );
  }
}
