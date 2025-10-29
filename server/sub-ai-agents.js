/**
 * Sub-AI Agent System
 * Specialized AI agents that receive assignments from ATLANTIS
 * and create work bots to execute specific tasks
 */

const { v4: uuidv4 } = require('uuid');

class SubAIAgent {
  constructor(db, agentData, aiClients) {
    this.db = db;
    this.agentId = agentData.agent_id;
    this.name = agentData.name;
    this.specialization = agentData.specialization;
    this.expertiseAreas = JSON.parse(agentData.expertise_areas);
    this.aiClients = aiClients;
    this.maxWorkBots = 5;
  }

  /**
   * Process assignment from ATLANTIS
   * @param {Object} assignment - Assignment object
   * @returns {Promise<Object>} - Processing result
   */
  async processAssignment(assignment) {
    console.log(`🤖 ${this.name}: Processing assignment ${assignment.assignment_id}`);

    try {
      // Update assignment status
      this.updateAssignmentStatus(assignment.id, 'in-progress');

      // Analyze the assignment
      const analysis = await this.analyzeAssignment(assignment);

      // Create work bots based on analysis
      const workBots = await this.createWorkBots(assignment, analysis);

      // Execute work bots
      await this.executeWorkBots(workBots, assignment);

      // Report back to ATLANTIS
      await this.reportToAtlantis(assignment);

      return {
        success: true,
        workBots: workBots.length,
        message: `${this.name} completed assignment`
      };
    } catch (error) {
      console.error(`❌ ${this.name} Error:`, error);
      this.updateAssignmentStatus(assignment.id, 'failed');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze assignment to determine work breakdown
   * @param {Object} assignment - Assignment object
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeAssignment(assignment) {
    const elements = JSON.parse(assignment.assigned_elements);

    const prompt = `You are ${this.name}, a specialized AI agent with expertise in ${this.specialization}.

Your areas of expertise: ${this.expertiseAreas.join(', ')}

You've been assigned the following work elements:
${elements.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Analyze these elements and break them down into specific, actionable tasks that can be executed by work bots.

For each task, specify:
1. Task description
2. Bot type needed (research, code-generation, testing, documentation, deployment, analysis)
3. Expected output
4. Dependencies on other tasks

Return as JSON:
{
  "tasks": [
    {
      "description": "...",
      "botType": "code-generation",
      "expectedOutput": "...",
      "dependencies": []
    }
  ],
  "strategy": "Overall approach to completing this work"
}`;

    try {
      const response = await this.aiClients.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return JSON.parse(response.content[0].text);
    } catch (error) {
      console.error('Analysis error:', error);
      // Fallback
      return {
        tasks: elements.map(e => ({
          description: e,
          botType: 'general',
          expectedOutput: `Complete: ${e}`
        })),
        strategy: 'Sequential execution'
      };
    }
  }

  /**
   * Create work bots based on analysis
   * @param {Object} assignment - Assignment object
   * @param {Object} analysis - Analysis result
   * @returns {Promise<Array>} - Created work bots
   */
  async createWorkBots(assignment, analysis) {
    console.log(`🔧 ${this.name}: Creating work bots...`);

    const workBots = [];

    for (const task of analysis.tasks.slice(0, this.maxWorkBots)) {
      const botId = `bot-${uuidv4()}`;

      const stmt = this.db.prepare(`
        INSERT INTO work_bots (
          bot_id, assignment_id, agent_id, bot_type, task_description, status
        ) VALUES (?, ?, ?, ?, ?, 'created')
      `);

      const agentRecord = this.db.prepare(
        'SELECT id FROM sub_ai_agents WHERE agent_id = ?'
      ).get(this.agentId);

      stmt.run(
        botId,
        assignment.id,
        agentRecord.id,
        task.botType,
        task.description
      );

      workBots.push({
        botId,
        type: task.botType,
        description: task.description,
        expectedOutput: task.expectedOutput
      });
    }

    return workBots;
  }

  /**
   * Execute work bots
   * @param {Array} workBots - Work bots to execute
   * @param {Object} assignment - Assignment object
   */
  async executeWorkBots(workBots, assignment) {
    console.log(`⚡ ${this.name}: Executing ${workBots.length} work bots...`);

    for (const bot of workBots) {
      try {
        // Update bot status
        this.db.prepare(
          'UPDATE work_bots SET status = ?, started_at = CURRENT_TIMESTAMP WHERE bot_id = ?'
        ).run('running', bot.botId);

        // Execute bot task
        const result = await this.executeWorkBot(bot);

        // Save result
        this.db.prepare(
          'UPDATE work_bots SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE bot_id = ?'
        ).run('completed', JSON.stringify(result), bot.botId);

        // Add progress update
        this.addProgressUpdate(assignment.task_id, bot.botId, 
          `Work bot completed: ${bot.description.substring(0, 50)}...`);

      } catch (error) {
        console.error(`Work bot ${bot.botId} failed:`, error);
        this.db.prepare(
          'UPDATE work_bots SET status = ?, result = ? WHERE bot_id = ?'
        ).run('failed', JSON.stringify({ error: error.message }), bot.botId);
      }
    }

    // Update assignment progress
    const completedBots = this.db.prepare(
      'SELECT COUNT(*) as count FROM work_bots WHERE assignment_id = ? AND status = "completed"'
    ).get(assignment.id);

    const progress = Math.round((completedBots.count / workBots.length) * 100);
    this.db.prepare(
      'UPDATE task_assignments SET progress = ? WHERE id = ?'
    ).run(progress, assignment.id);
  }

  /**
   * Execute individual work bot
   * @param {Object} bot - Work bot
   * @returns {Promise<Object>} - Execution result
   */
  async executeWorkBot(bot) {
    console.log(`🤖 Executing work bot: ${bot.type}`);

    const prompt = `You are a specialized work bot of type: ${bot.type}
Created by: ${this.name}

Task: ${bot.description}

Execute this task and provide detailed results. Include:
1. What was accomplished
2. Output/deliverable
3. Any issues encountered
4. Recommendations

Be specific and actionable.`;

    try {
      const response = await this.aiClients.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return {
        success: true,
        output: response.content[0].text,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Report completion back to ATLANTIS
   * @param {Object} assignment - Assignment object
   */
  async reportToAtlantis(assignment) {
    console.log(`📊 ${this.name}: Reporting to ATLANTIS...`);

    // Get all work bot results
    const results = this.db.prepare(
      'SELECT * FROM work_bots WHERE assignment_id = ?'
    ).all(assignment.id);

    const completed = results.filter(r => r.status === 'completed').length;
    const total = results.length;

    // Update assignment status
    const status = completed === total ? 'completed' : 'partial';
    this.db.prepare(
      'UPDATE task_assignments SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(status, assignment.id);

    // Decrease agent load
    const agentRecord = this.db.prepare(
      'SELECT id FROM sub_ai_agents WHERE agent_id = ?'
    ).get(this.agentId);

    this.db.prepare(
      'UPDATE sub_ai_agents SET current_load = current_load - 1 WHERE id = ?'
    ).run(agentRecord.id);

    // Add progress update
    this.addProgressUpdate(assignment.task_id, this.agentId,
      `${this.name} completed assignment: ${completed}/${total} work bots successful`);
  }

  /**
   * Update assignment status
   * @param {number} assignmentId - Assignment ID
   * @param {string} status - New status
   */
  updateAssignmentStatus(assignmentId, status) {
    const updateStmt = this.db.prepare(
      'UPDATE task_assignments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );

    if (status === 'in-progress') {
      this.db.prepare(
        'UPDATE task_assignments SET started_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(assignmentId);
    }

    updateStmt.run(status, assignmentId);
  }

  /**
   * Add progress update
   * @param {number} taskId - Task ID
   * @param {string} sourceId - Source identifier
   * @param {string} message - Progress message
   */
  addProgressUpdate(taskId, sourceId, message) {
    const updateId = `update-${uuidv4()}`;
    const stmt = this.db.prepare(`
      INSERT INTO progress_updates (
        update_id, task_id, source_type, source_id, message
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(updateId, taskId, 'sub-ai', sourceId, message);
  }
}

/**
 * Sub-AI Manager - Manages all sub-AI agents
 */
class SubAIManager {
  constructor(db, aiClients) {
    this.db = db;
    this.aiClients = aiClients;
    this.agents = new Map();
    this.initializeAgents();
  }

  /**
   * Initialize all sub-AI agents
   */
  initializeAgents() {
    const agentRecords = this.db.prepare(
      'SELECT * FROM sub_ai_agents WHERE status = "active"'
    ).all();

    for (const agentData of agentRecords) {
      const agent = new SubAIAgent(this.db, agentData, this.aiClients);
      this.agents.set(agentData.agent_id, agent);
    }

    console.log(`✅ Initialized ${this.agents.size} sub-AI agents`);
  }

  /**
   * Get agent by ID
   * @param {string} agentId - Agent ID
   * @returns {SubAIAgent} - Sub-AI agent
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Process pending assignments
   */
  async processPendingAssignments() {
    const pending = this.db.prepare(`
      SELECT ta.*, sa.agent_id
      FROM task_assignments ta
      JOIN sub_ai_agents sa ON ta.agent_id = sa.id
      WHERE ta.status = 'assigned'
    `).all();

    for (const assignment of pending) {
      const agent = this.getAgent(assignment.agent_id);
      if (agent) {
        await agent.processAssignment(assignment);
      }
    }
  }

  /**
   * Get all agents status
   * @returns {Array} - Agents status
   */
  getAgentsStatus() {
    const agentsStatus = this.db.prepare(`
      SELECT 
        agent_id, 
        name, 
        specialization, 
        current_load, 
        max_capacity,
        performance_score
      FROM sub_ai_agents
      WHERE status = 'active'
    `).all();

    return agentsStatus;
  }
}

module.exports = {
  SubAIAgent,
  SubAIManager
};
