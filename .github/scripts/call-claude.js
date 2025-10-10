/**
 * Claude API Calling Script
 * Handles API calls to Claude with conversation history context
 */

const core = require('@actions/core');
const https = require('https');

/**
 * Call Claude API with enhanced context
 * @param {Object} context - Enhanced context object
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object>} - Claude response
 */
async function callClaudeAPI(context, apiKey) {
  const {
    task,
    metadata,
    conversationHistory,
    contextualInsights,
    privacyMetadata
  } = context;

  // Build system prompt with conversation history
  const systemPrompt = buildClaudeSystemPrompt(context);

  // Build user message
  const userMessage = buildClaudeUserMessage(context);

  // Prepare API request
  const requestBody = {
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage
      }
    ],
    temperature: 0.7,
    metadata: {
      user_id: metadata.author,
      issue_number: metadata.issueNumber.toString(),
      task_type: metadata.taskType
    }
  };

  // Add conversation history if available
  if (conversationHistory.permissionsGranted && conversationHistory.userAIHistory.length > 0) {
    requestBody.messages = buildConversationHistoryMessages(
      conversationHistory.userAIHistory,
      userMessage
    );
  }

  console.log('🧠 Calling Claude API...');
  console.log(`Task Type: ${metadata.taskType}`);
  console.log(`Conversation History: ${conversationHistory.userAIHistory.length} previous interactions`);

  try {
    const response = await makeClaudeRequest(requestBody, apiKey);
    
    console.log('✅ Claude API response received');
    console.log(`Response length: ${response.content[0].text.length} characters`);
    console.log(`Tokens used: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`);

    return {
      success: true,
      response: response.content[0].text,
      metadata: {
        model: response.model,
        stopReason: response.stop_reason,
        usage: response.usage
      }
    };
  } catch (error) {
    console.error('❌ Claude API error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Build Claude system prompt with context
 * @param {Object} context - Enhanced context object
 * @returns {string} - System prompt
 */
function buildClaudeSystemPrompt(context) {
  const {
    metadata,
    conversationHistory,
    contextualInsights,
    privacyMetadata
  } = context;

  let systemPrompt = `You are Claude, an advanced AI assistant integrated into the US-SPURS Multi-AI Collaborative System.

## Your Role:
You are responding to a GitHub issue in the ${metadata.repository.name} repository. This is part of a collaborative AI ecosystem where multiple AI systems work together.

## Task Context:
- Task Type: ${metadata.taskType}
- Priority: ${metadata.labels.find(l => l.startsWith('priority:')) || 'normal'}
- Project: ${metadata.repository.owner}/${metadata.repository.name}

## Response Guidelines:
1. Provide comprehensive, well-structured responses
2. Use markdown formatting for clarity
3. Include code examples when relevant
4. Consider the conversation history and user preferences
5. If this is a multi-AI task, coordinate with other AI systems
6. Always cite sources or reasoning for technical recommendations

## Output Format:
Start your response with: ### 🧠 Claude AI Response

Then provide your analysis/solution in a structured format.`;

  // Add conversation history context if available
  if (conversationHistory.permissionsGranted && conversationHistory.userAIHistory.length > 0) {
    systemPrompt += `\n\n## Conversation History Context:
You have ${conversationHistory.userAIHistory.length} previous interactions with this user.`;

    if (contextualInsights.userPreferences?.available) {
      const prefs = contextualInsights.userPreferences;
      systemPrompt += `\n\n## User Preferences:
- Detail Level: ${prefs.communicationStyle.preferredDetailLevel}
- Format: ${prefs.communicationStyle.preferredFormat}
- Technical Depth: ${prefs.communicationStyle.technicalDepth}
- Primary Languages: ${prefs.technicalContext.primaryLanguages.join(', ')}
- Common Task Types: ${prefs.taskPreferences.mostCommonTaskTypes.join(', ')}`;
    }
  }

  // Add project patterns if available
  if (conversationHistory.permissionsGranted && contextualInsights.projectPatterns?.available) {
    const patterns = contextualInsights.projectPatterns;
    systemPrompt += `\n\n## Project Context:
- Most Used AI: ${patterns.aiUsagePatterns.mostUsedAI}
- Technical Stack: ${Object.keys(patterns.technicalStack.languages).join(', ')}
- Collaborative Tasks: ${(patterns.aiUsagePatterns.collaborativeTasksRatio * 100).toFixed(0)}%`;
  }

  // Add privacy notice
  systemPrompt += `\n\n## Privacy Notice:
Conversation history consent: ${privacyMetadata.consentStatus}
Data scope: ${privacyMetadata.consentScope}`;

  return systemPrompt;
}

/**
 * Build Claude user message
 * @param {Object} context - Enhanced context object
 * @returns {string} - User message
 */
function buildClaudeUserMessage(context) {
  const { task, metadata, conversation } = context;

  let message = `# Issue #${metadata.issueNumber}: ${metadata.title}\n\n`;

  // Add task description
  message += `## Task Description:\n${task.description}\n\n`;

  // Add requirements if available
  if (task.requirements.length > 0) {
    message += `## Requirements:\n`;
    task.requirements.forEach((req, i) => {
      message += `${i + 1}. ${req}\n`;
    });
    message += '\n';
  }

  // Add technical specs if available
  if (task.technicalSpecs.language || task.technicalSpecs.framework) {
    message += `## Technical Specifications:\n`;
    if (task.technicalSpecs.language) {
      message += `- Language: ${task.technicalSpecs.language}\n`;
    }
    if (task.technicalSpecs.framework) {
      message += `- Framework: ${task.technicalSpecs.framework}\n`;
    }
    if (task.technicalSpecs.libraries.length > 0) {
      message += `- Libraries: ${task.technicalSpecs.libraries.join(', ')}\n`;
    }
    message += '\n';
  }

  // Add constraints if available
  if (task.constraints.length > 0) {
    message += `## Constraints:\n`;
    task.constraints.forEach((constraint, i) => {
      message += `${i + 1}. ${constraint}\n`;
    });
    message += '\n';
  }

  // Add acceptance criteria if available
  if (task.acceptanceCriteria.length > 0) {
    message += `## Acceptance Criteria:\n`;
    task.acceptanceCriteria.forEach((criteria, i) => {
      message += `${i + 1}. ${criteria}\n`;
    });
    message += '\n';
  }

  // Add conversation context if there are comments
  if (conversation.timeline.length > 0) {
    message += `## Conversation Thread:\n`;
    conversation.timeline.slice(-5).forEach(comment => {
      message += `**${comment.author}** (${comment.createdAt}):\n${comment.body}\n\n`;
    });
  }

  message += `\nPlease provide a comprehensive response addressing this task.`;

  return message;
}

/**
 * Build conversation history messages for Claude
 * @param {Array} history - Conversation history array
 * @param {string} currentMessage - Current user message
 * @returns {Array} - Array of messages
 */
function buildConversationHistoryMessages(history, currentMessage) {
  const messages = [];

  // Add last 5 conversations for context
  const recentHistory = history.slice(-5);

  for (const conv of recentHistory) {
    if (conv.messages && conv.messages.length > 0) {
      // Add user message
      const userMsg = conv.messages.find(m => m.role === 'user');
      if (userMsg) {
        messages.push({
          role: 'user',
          content: `[Previous conversation - ${new Date(conv.metadata.createdAt).toLocaleDateString()}]\n${userMsg.content.substring(0, 500)}...`
        });
      }

      // Add assistant response
      const assistantMsg = conv.messages.find(m => m.role === 'assistant');
      if (assistantMsg) {
        messages.push({
          role: 'assistant',
          content: assistantMsg.content.substring(0, 500) + '...'
        });
      }
    }
  }

  // Add current message
  messages.push({
    role: 'user',
    content: currentMessage
  });

  return messages;
}

/**
 * Make HTTP request to Claude API
 * @param {Object} requestBody - Request body
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} - API response
 */
function makeClaudeRequest(requestBody, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(requestBody);

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    callClaudeAPI,
    buildClaudeSystemPrompt,
    buildClaudeUserMessage,
    buildConversationHistoryMessages,
    makeClaudeRequest
  };
}
