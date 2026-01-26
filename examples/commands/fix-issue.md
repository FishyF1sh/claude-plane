# Fix Plane Issue

Handle one or more Plane issues by implementing fixes, committing changes, and updating the issue status.

## Arguments

$ARGUMENTS - Issue identifiers (e.g., `PROJ-123` or multiple: `PROJ-123 PROJ-124`)

## Workflow

1. **Fetch issue details** - Use `plane_list_projects` to find the project, then `plane_get_work_item` to get full issue details including description, comments, and current state.

2. **Understand the issue** - Read the issue description and any comments to understand what needs to be done. If the issue references specific files or code, locate and read them.

3. **Implement the fix** - Make the necessary code changes. Follow existing code patterns and style conventions in the codebase.

4. **Test the changes** - If tests exist, run them to verify the fix doesn't break anything. If applicable, add new tests for the fix.

5. **Commit changes** - Create a commit with a clear message that references the issue ID:
   ```
   Fix: Brief description of the fix (PROJ-123)
   ```

6. **Update Plane issue** - Use `plane_create_comment` to add a comment summarizing what was done and linking to the commit. Then use `plane_update_work_item` to set the state to "Done" (completed state).

## Notes

- If the issue is unclear, add a comment asking for clarification rather than guessing
- For complex issues, break down the work and document progress in comments
- If a fix cannot be completed, update the issue with what was attempted and what's blocking progress
