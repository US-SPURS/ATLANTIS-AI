/**
 * GitHub Webhook Handler
 * Processes GitHub events and routes them to ATLANTIS
 */

const crypto = require('crypto');
const express = require('express');

class GitHubWebhookHandler {
  constructor(db, atlantis, secret) {
    this.db = db;
    this.atlantis = atlantis;
    this.secret = secret;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.post('/webhook', (req, res) => this.handleWebhook(req, res));
  }

  verifySignature(payload, signature) {
    if (!this.secret) return true; // Skip verification if no secret

    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  async handleWebhook(req, res) {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    
    if (!this.verifySignature(JSON.stringify(req.body), signature)) {
      console.warn('❌ Invalid webhook signature');
      return res.status(401).send('Invalid signature');
    }

    console.log(`📨 Received GitHub webhook: ${event}`);

    try {
      switch (event) {
        case 'issues':
          await this.handleIssueEvent(req.body);
          break;
        case 'issue_comment':
          await this.handleIssueCommentEvent(req.body);
          break;
        case 'pull_request':
          await this.handlePullRequestEvent(req.body);
          break;
        case 'push':
          await this.handlePushEvent(req.body);
          break;
        case 'discussion':
          await this.handleDiscussionEvent(req.body);
          break;
        default:
          console.log(`Unhandled event: ${event}`);
      }

      res.status(200).send('Webhook processed');
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).send('Processing error');
    }
  }

  async handleIssueEvent(payload) {
    const { action, issue, repository } = payload;

    if (action === 'opened' || action === 'reopened') {
      // Check if issue mentions ATLANTIS or has specific labels
      const body = issue.body || '';
      const labels = issue.labels.map(l => l.name);

      if (body.includes('@atlantis') || labels.includes('atlantis-task')) {
        console.log('🌟 ATLANTIS task detected in issue');

        // Create task from issue
        const userId = issue.user.login;
        
        // Get or create user
        let user = this.db.prepare('SELECT * FROM users WHERE github_username = ?').get(userId);
        if (!user) {
          const stmt = this.db.prepare('INSERT INTO users (github_username) VALUES (?)');
          const result = stmt.run(userId);
          user = { id: result.lastInsertRowid };
        }

        // Extract priority from labels
        let priority = 'normal';
        if (labels.includes('priority:critical')) priority = 'critical';
        else if (labels.includes('priority:high')) priority = 'high';
        else if (labels.includes('priority:low')) priority = 'low';

        // Create task
        await this.atlantis.receiveTask({
          userId: user.id,
          title: issue.title,
          description: body,
          priority,
          availableResources: `GitHub Issue: ${issue.html_url}`
        });

        console.log(`✅ Task created from issue #${issue.number}`);
      }
    }
  }

  async handleIssueCommentEvent(payload) {
    const { action, comment, issue } = payload;

    if (action === 'created') {
      const body = comment.body || '';

      // Check for ATLANTIS commands
      if (body.startsWith('/atlantis ')) {
        const command = body.substring(10).trim();
        await this.processAtlantisCommand(command, issue, comment);
      }
    }
  }

  async processAtlantisCommand(command, issue, comment) {
    console.log(`🎯 Processing ATLANTIS command: ${command}`);

    const [action, ...args] = command.split(' ');

    switch (action) {
      case 'create-task':
        // Create task from current issue
        console.log('Creating task from issue command');
        break;
      case 'status':
        // Get task status
        console.log('Getting task status');
        break;
      case 'help':
        // Show help
        console.log('Showing ATLANTIS help');
        break;
      default:
        console.log(`Unknown command: ${action}`);
    }
  }

  async handlePullRequestEvent(payload) {
    const { action, pull_request } = payload;

    if (action === 'opened') {
      console.log(`📝 New PR opened: ${pull_request.title}`);

      // Check if PR is related to an ATLANTIS task
      const body = pull_request.body || '';
      const taskIdMatch = body.match(/ATLANTIS Task: (task-[a-f0-9-]+)/i);

      if (taskIdMatch) {
        const taskId = taskIdMatch[1];
        console.log(`🔗 PR linked to task: ${taskId}`);

        // Update task with PR reference
        const task = this.db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
        if (task) {
          this.atlantis.addProgressUpdate(
            task.id,
            'github',
            'pull-request',
            `Pull request created: ${pull_request.html_url}`,
            null
          );
        }
      }
    }
  }

  async handlePushEvent(payload) {
    const { ref, commits, repository } = payload;
    const branch = ref.replace('refs/heads/', '');

    console.log(`📤 Push to ${branch}: ${commits.length} commits`);

    // Check commit messages for task references
    for (const commit of commits) {
      const taskIdMatch = commit.message.match(/task-([\w-]+)/i);
      if (taskIdMatch) {
        const taskId = taskIdMatch[0];
        const task = this.db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
        
        if (task) {
          this.atlantis.addProgressUpdate(
            task.id,
            'github',
            'commit',
            `New commit: ${commit.message.substring(0, 100)}`,
            null
          );
        }
      }
    }
  }

  async handleDiscussionEvent(payload) {
    const { action, discussion } = payload;
    console.log(`💬 Discussion ${action}: ${discussion.title}`);

    // Can integrate discussions with ATLANTIS for team collaboration
  }

  getRouter() {
    return this.router;
  }
}

module.exports = GitHubWebhookHandler;
