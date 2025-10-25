/**
 * ATLANTIS Master AI Coordinator
 * The master AI that receives tasks, understands intent, creates project plans,
 * and delegates to 12 specialized sub-AI agents
 */

const { v4: uuidv4 } = require('uuid');

class AtlantisAI {
  constructor(db, aiClients) {
    this.db = db;
    this.aiClients = aiClients; // { claude, openai }
    this.name = 'ATLANTIS';
    this.version = '1.0.0';
    this.maxSubAIs = 12;
  }

  /**
   * Main entry point: Receive task from user
   * @param {Object} taskInput - User's task input
   * @returns {Promise<Object>} - Task processing result
   */
  async receiveTask(taskInput) {
    console.log('🌟 ATLANTIS: Receiving new task...');

    try {
      // Step 1: Create task record
      const task = await this.createTask(taskInput);

      // Step 2: Understand user intent
      const understanding = await this.understandIntent(task);

      // Step 3: Create project plan
      const projectPlan = await this.createProjectPlan(task, understanding);

      // Step 4: Delegate to sub-AIs
      const assignments = await this.delegateToSubAIs(task, projectPlan);

      // Step 5: Start monitoring
      this.monitorProgress(task.id);

      return {
        success: true,
        taskId: task.task_id,
        understanding,
        projectPlan,
        assignments,
        message: 'Task received and processing initiated'
      };
    } catch (error) {
      console.error('❌ ATLANTIS Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create task record in database
   * @param {Object} input - Task input from user
   * @returns {Object} - Created task
   */
  async createTask(input) {
    const taskId = `task-${uuidv4()}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        task_id, user_id, title, description, intent, 
        timeline, desired_outcomes, available_resources, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      taskId,
      input.userId,
      input.title,
      input.description || '',
      '', // Will be filled by understandIntent
      input.timeline || '',
      input.desiredOutcomes || '',
      JSON.stringify(input.availableResources || []),
      input.priority || 'normal'
    );

    return {
      id: result.lastInsertRowid,
      task_id: taskId,
      ...input
    };
  }

  /**
   * Understand user intent using Claude AI
   * @param {Object} task - Task object
   * @returns {Promise<Object>} - Understanding analysis
   */
  async understandIntent(task) {
    console.log('🧠 ATLANTIS: Analyzing user intent...');

    const prompt = `You are ATLANTIS, a master AI coordinator. Analyze the following task and provide a comprehensive understanding.

Task Title: ${task.title}
Description: ${task.description}
Timeline: ${task.timeline || 'Not specified'}
Desired Outcomes: ${task.desired_outcomes || 'Not specified'}
Available Resources: ${task.available_resources || 'Not specified'}

Provide a structured analysis including:
1. Primary Intent: What is the user really trying to achieve?
2. Secondary Goals: What are implicit goals?
3. Success Criteria: How will we know this is complete?
4. Constraints: What limitations exist?
5. Required Expertise: What specializations are needed?
6. Complexity Assessment: Simple, Moderate, Complex, or Advanced
7. Estimated Effort: Time and resource estimation
8. Risk Factors: Potential challenges

Return as JSON.`;

    try {
      const response = await this.aiClients.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const understanding = JSON.parse(response.content[0].text);

      // Update task with understanding
      const updateStmt = this.db.prepare('UPDATE tasks SET intent = ? WHERE id = ?');
      updateStmt.run(JSON.stringify(understanding), task.id);

      return understanding;
    } catch (error) {
      console.error('Error understanding intent:', error);
      // Fallback to basic understanding
      return {
        primaryIntent: task.description,
        complexity: 'Moderate',
        requiredExpertise: ['General']
      };
    }
  }

  /**
   * Create detailed project plan
   * @param {Object} task - Task object
   * @param {Object} understanding - Intent understanding
   * @returns {Promise<Object>} - Project plan
   */
  async createProjectPlan(task, understanding) {
    console.log('📋 ATLANTIS: Creating project plan...');

    const prompt = `You are ATLANTIS, a master AI project planner. Create a comprehensive project plan.

Task: ${task.title}
Description: ${task.description}
Understanding: ${JSON.stringify(understanding, null, 2)}

Create a detailed project plan with:
1. Project Overview
2. Breakdown of work packages
3. Dependencies between packages
4. Recommended sub-AI assignments (choose from: Code Architect, System Architect, Quality Assurance, Security Guardian, Documentation Expert, DevOps Engineer, Data Scientist, UI/UX Designer, Backend Specialist, Frontend Specialist, Database Expert, API Designer)
5. Milestones and deliverables
6. Timeline estimates
7. Risk mitigation strategies

Return as JSON with this structure:
{
  "overview": "...",
  "workPackages": [
    {
      "id": "wp-1",
      "name": "...",
      "description": "...",
      "assignedTo": "sub-ai-code",
      "elements": ["element1", "element2"],
      "estimatedEffort": "2 hours",
      "dependencies": []
    }
  ],
  "milestones": [],
  "timeline": "..."
}`;

    try {
      const response = await this.aiClients.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const plan = JSON.parse(response.content[0].text);

      // Save project plan
      const planId = `plan-${uuidv4()}`;
      const stmt = this.db.prepare(`
        INSERT INTO project_plans (plan_id, task_id, plan_data)
        VALUES (?, ?, ?)
      `);
      stmt.run(planId, task.id, JSON.stringify(plan));

      return plan;
    } catch (error) {
      console.error('Error creating project plan:', error);
      // Fallback basic plan
      return {
        overview: 'Auto-generated basic plan',
        workPackages: [{
          id: 'wp-1',
          name: 'Complete task',
          assignedTo: 'sub-ai-code',
          elements: ['Main implementation']
        }]
      };
    }
  }

  /**
   * Delegate work packages to sub-AIs
   * @param {Object} task - Task object
   * @param {Object} plan - Project plan
   * @returns {Promise<Array>} - Assignment records
   */
  async delegateToSubAIs(task, plan) {
    console.log('🎯 ATLANTIS: Delegating to sub-AIs...');

    const assignments = [];

    for (const workPackage of plan.workPackages) {
      // Get sub-AI agent
      const agent = this.db.prepare(
        'SELECT * FROM sub_ai_agents WHERE agent_id = ?'
      ).get(workPackage.assignedTo);

      if (!agent) {
        console.warn(`Agent ${workPackage.assignedTo} not found, skipping`);
        continue;
      }

      // Create assignment
      const assignmentId = `assign-${uuidv4()}`;
      const stmt = this.db.prepare(`
        INSERT INTO task_assignments (
          assignment_id, task_id, agent_id, assigned_elements, status
        ) VALUES (?, ?, ?, ?, 'assigned')
      `);

      stmt.run(
        assignmentId,
        task.id,
        agent.id,
        JSON.stringify(workPackage.elements)
      );

      // Update agent load
      this.db.prepare(
        'UPDATE sub_ai_agents SET current_load = current_load + 1 WHERE id = ?'
      ).run(agent.id);

      assignments.push({
        assignmentId,
        agentName: agent.name,
        workPackage: workPackage.name,
        elements: workPackage.elements
      });

      // Create progress update
      this.addProgressUpdate(task.id, 'atlantis', this.name, 
        `Assigned "${workPackage.name}" to ${agent.name}`, 10);
    }

    // Update task status
    this.db.prepare(
      'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('in-progress', task.id);

    return assignments;
  }

  /**
   * Monitor task progress
   * @param {number} taskId - Task ID
   */
  async monitorProgress(taskId) {
    console.log('👀 ATLANTIS: Monitoring task progress...');

    // Check assignments
    const assignments = this.db.prepare(`
      SELECT ta.*, sa.name as agent_name
      FROM task_assignments ta
      JOIN sub_ai_agents sa ON ta.agent_id = sa.id
      WHERE ta.task_id = ?
    `).all(taskId);

    const completed = assignments.filter(a => a.status === 'completed').length;
    const total = assignments.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update task progress
    this.addProgressUpdate(taskId, 'atlantis', this.name,
      `Overall progress: ${completed}/${total} assignments completed`, progress);

    // Check if all completed
    if (completed === total && total > 0) {
      await this.finalizeTask(taskId);
    }

    return { completed, total, progress };
  }

  /**
   * Finalize completed task
   * @param {number} taskId - Task ID
   */
  async finalizeTask(taskId) {
    console.log('🎉 ATLANTIS: Finalizing task...');

    // Update task status
    this.db.prepare(`
      UPDATE tasks 
      SET status = 'completed', 
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId);

    // Add completion update
    this.addProgressUpdate(taskId, 'atlantis', this.name,
      'Task completed successfully! All work packages finished.', 100);
  }

  /**
   * Add progress update
   * @param {number} taskId - Task ID
   * @param {string} sourceType - Source type (atlantis, sub-ai, work-bot)
   * @param {string} sourceId - Source identifier
   * @param {string} message - Progress message
   * @param {number} progress - Progress percentage
   */
  addProgressUpdate(taskId, sourceType, sourceId, message, progress = null) {
    const updateId = `update-${uuidv4()}`;
    const stmt = this.db.prepare(`
      INSERT INTO progress_updates (
        update_id, task_id, source_type, source_id, message, progress_percentage
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(updateId, taskId, sourceType, sourceId, message, progress);
  }

  /**
   * Get task status and updates
   * @param {string} taskId - Task ID (UUID format)
   * @returns {Object} - Task status
   */
  getTaskStatus(taskId) {
    const task = this.db.prepare(
      'SELECT * FROM tasks WHERE task_id = ?'
    ).get(taskId);

    if (!task) {
      return { error: 'Task not found' };
    }

    const assignments = this.db.prepare(`
      SELECT ta.*, sa.name as agent_name, sa.specialization
      FROM task_assignments ta
      JOIN sub_ai_agents sa ON ta.agent_id = sa.id
      WHERE ta.task_id = ?
    `).all(task.id);

    const updates = this.db.prepare(
      'SELECT * FROM progress_updates WHERE task_id = ? ORDER BY created_at DESC'
    ).all(task.id);

    return {
      task,
      assignments,
      updates
    };
  }

  /**
   * Interact with user - respond to queries
   * @param {string} taskId - Task ID
   * @param {string} userMessage - User's message
   * @returns {Promise<string>} - ATLANTIS response
   */
  async interactWithUser(taskId, userMessage) {
    const status = this.getTaskStatus(taskId);

    const prompt = `You are ATLANTIS, the master AI coordinator. 

Task Status: ${JSON.stringify(status, null, 2)}

User Message: ${userMessage}

Provide a helpful, informative response about the task status, progress, or answer the user's question.
Be concise but comprehensive.`;

    try {
      const response = await this.aiClients.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].text;
    } catch (error) {
      return `I'm monitoring your task. Status: ${status.task.status}`;
    }
  }
}

module.exports = AtlantisAI;
