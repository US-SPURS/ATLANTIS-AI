/**
 * GitHub Projects Integration
 * Syncs ATLANTIS tasks with GitHub Projects
 * 
 * Note: This uses Projects v1 API which is being deprecated.
 * Future versions should migrate to Projects v2 (GraphQL API).
 * See: https://docs.github.com/en/issues/planning-and-tracking-with-projects
 */

const { Octokit } = require('@octokit/rest');

class GitHubProjectsIntegration {
  constructor(token, owner, repo) {
    this.octokit = token ? new Octokit({ auth: token }) : null;
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Create or update project item for task
   * @param {Object} task - Task object
   * @returns {Promise<void>}
   */
  async syncTaskToProject(task) {
    if (!this.octokit) {
      console.log('GitHub token not configured, skipping project sync');
      return;
    }

    try {
      // Get repository project
      const { data: projects } = await this.octokit.projects.listForRepo({
        owner: this.owner,
        repo: this.repo
      });

      if (projects.length === 0) {
        console.log('No projects found in repository');
        return;
      }

      const project = projects[0]; // Use first project

      // Create a card for the task
      const column = await this.getOrCreateColumn(project.id, this.getColumnForStatus(task.status));

      await this.octokit.projects.createCard({
        column_id: column.id,
        note: `**${task.title}**\n\n${task.description}\n\nPriority: ${task.priority}\nStatus: ${task.status}`
      });

      console.log(`✅ Task synced to GitHub Project: ${task.title}`);
    } catch (error) {
      console.error('Error syncing to GitHub Projects:', error.message);
    }
  }

  /**
   * Get or create project column
   * @param {number} projectId - Project ID
   * @param {string} columnName - Column name
   * @returns {Promise<Object>} Column object
   */
  async getOrCreateColumn(projectId, columnName) {
    const { data: columns } = await this.octokit.projects.listColumns({
      project_id: projectId
    });

    let column = columns.find(c => c.name === columnName);

    if (!column) {
      const { data: newColumn } = await this.octokit.projects.createColumn({
        project_id: projectId,
        name: columnName
      });
      column = newColumn;
    }

    return column;
  }

  /**
   * Get column name for task status
   * @param {string} status - Task status
   * @returns {string} Column name
   */
  getColumnForStatus(status) {
    const columnMap = {
      'pending': 'To Do',
      'in-progress': 'In Progress',
      'completed': 'Done'
    };
    return columnMap[status] || 'To Do';
  }

  /**
   * Move task card to appropriate column
   * Note: This is a placeholder for future implementation.
   * Requires tracking card IDs in the database.
   * @param {string} taskId - Task ID
   * @param {string} newStatus - New status
   */
  async moveTaskCard(taskId, newStatus) {
    if (!this.octokit) return;

    // TODO: Implement card movement
    // This requires storing GitHub card IDs in the database
    // and using the Projects API to move cards between columns
    console.log(`TODO: Move task ${taskId} to ${this.getColumnForStatus(newStatus)}`);
  }
}

module.exports = GitHubProjectsIntegration;
