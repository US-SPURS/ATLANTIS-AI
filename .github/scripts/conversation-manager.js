/**
 * Conversation Manager Script
 * Manages conversation storage, retrieval, and consent handling
 */

const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;
const path = require('path');
const {
  initializeCacheStructure,
  generateConversationId,
  checkUserPermissions,
  requestUserPermission,
  storeUserPermissions,
  saveConversation,
  handleConsentCommand,
  exportUserData,
  deleteUserHistory
} = require('./enhanced-context-builder');

/**
 * Main conversation manager handler
 * @param {Object} context - GitHub context
 * @param {string} token - GitHub token
 */
async function handleConversationManagement(context, token) {
  const octokit = github.getOctokit(token);
  const { payload } = context;

  // Check if this is a consent command
  if (payload.comment && payload.comment.body) {
    const body = payload.comment.body.trim();
    
    if (body.startsWith('/consent')) {
      await handleConsentCommandFromComment(
        octokit,
        payload,
        body
      );
      return;
    }
  }

  // Check if this is a new conversation that needs permission
  if (payload.issue && payload.action === 'opened') {
    const userId = payload.issue.user.login;
    const permissions = await checkUserPermissions(userId, 'claude');

    if (!permissions.allowed && permissions.requiresConsent) {
      await requestUserPermission(
        octokit,
        payload.repository.owner.login,
        payload.repository.name,
        payload.issue.number,
        userId
      );
    }
  }
}

/**
 * Handle consent command from comment
 * @param {Object} octokit - GitHub API client
 * @param {Object} payload - Webhook payload
 * @param {string} commandBody - Command body
 */
async function handleConsentCommandFromComment(octokit, payload, commandBody) {
  const userId = payload.comment.user.login;
  const command = commandBody.replace('/consent', '').trim();

  console.log(`Processing consent command: ${command} from user: ${userId}`);

  const result = await handleConsentCommand(command, userId);

  // Post result as comment
  let responseBody = '';

  if (result.success) {
    responseBody = `### ✅ Consent Command Processed\n\n${result.message}\n\n`;

    if (result.scope) {
      responseBody += `**Current Scope:** \`${result.scope}\`\n`;
    }

    if (result.expiresIn) {
      responseBody += `**Expires In:** ${result.expiresIn}\n`;
    }

    if (result.permissions) {
      responseBody += `\n**Permission Details:**\n`;
      responseBody += `\`\`\`json\n${JSON.stringify(result.permissions, null, 2)}\n\`\`\`\n`;
    }

    responseBody += `\n---\n*Managed by US-SPURS AI Orchestration System*`;
  } else {
    responseBody = `### ❌ Consent Command Error\n\n${result.message}\n\n`;
    
    if (result.availableCommands) {
      responseBody += `**Available Commands:**\n`;
      result.availableCommands.forEach(cmd => {
        responseBody += `- \`/consent ${cmd}\`\n`;
      });
    }
  }

  await octokit.rest.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body: responseBody
  });

  console.log(`✓ Consent command response posted`);
}

/**
 * Store conversation after AI interaction
 * @param {Object} conversationData - Conversation data
 * @param {string} userId - User ID
 * @param {string} aiSystem - AI system name
 * @param {string} projectId - Project ID
 */
async function storeAIConversation(conversationData, userId, aiSystem, projectId) {
  // Check permissions
  const permissions = await checkUserPermissions(userId, aiSystem);

  if (!permissions.allowed) {
    console.log(`Conversation storage skipped - no permission from user: ${userId}`);
    return;
  }

  // Generate conversation ID
  const conversationId = generateConversationId(userId, aiSystem);

  // Build conversation object
  const conversation = {
    conversationId,
    userId,
    aiSystem,
    projectId,
    issueNumber: conversationData.issueNumber,
    messages: conversationData.messages,
    metadata: {
      createdAt: new Date().toISOString(),
      taskType: conversationData.taskType,
      successful: conversationData.successful !== false,
      hasFollowUp: conversationData.hasFollowUp || false,
      requiresClarification: conversationData.requiresClarification || false,
      qualityScore: conversationData.qualityScore || null,
      language: conversationData.language || null,
      framework: conversationData.framework || null,
      multiAI: conversationData.multiAI || false,
      completionTime: conversationData.completionTime || null
    }
  };

  // Save conversation
  const permissionObj = {
    individual: permissions.scope === 'all' || permissions.scope === 'individual',
    projectWide: permissions.scope === 'all' || permissions.scope === 'project',
    collective: permissions.scope === 'all'
  };

  await saveConversation(conversation, permissionObj);

  console.log(`✓ Conversation stored: ${conversationId}`);
}

/**
 * Initialize conversation management system
 */
async function initializeConversationSystem() {
  console.log('Initializing conversation management system...');
  
  await initializeCacheStructure();
  
  console.log('✓ Conversation management system initialized');
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleConversationManagement,
    handleConsentCommandFromComment,
    storeAIConversation,
    initializeConversationSystem
  };
}
