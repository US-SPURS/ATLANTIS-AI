/**
 * ChatGPT API Calling Script
 * Handles API calls to OpenAI ChatGPT with conversation history context
 */

const core = require('@actions/core');
const https = require('https');

/**
 * Call ChatGPT API with enhanced context
 * @param {Object} context - Enhanced context object
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} - ChatGPT response
 */
async function callChatGPTAPI(context, apiKey) {
  const {
    task,
    metadata,
    conversationHistory,
    contextualInsights,
    privacyMetadata
  } = context;

  // Build system message
  const systemMessage = buildChatGPTSystemMessage(context);

  // Build user message
  const userMessage = buildChatGPTUserMessage(context);

  // Prepare API request
  const requestBody = {
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: systemMessage
      }
    ],
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  };

  // Add conversation history if available
  if (conversationHistory.permissionsGranted && conversationHistory.userAIHistory.length > 0) {
    requestBody.messages = buildChatGPTConversationMessages(
      conversationHistory.userAIHistory,
      systemMessage,
      userMessage
    );
  } else {
    requestBody.messages.push({
      role: 'user',
      content: userMessage
    });
  }

  console.log('💬 Calling ChatGPT API...');
  console.log(`Task Type: ${metadata.taskType}`);
  console.log(`Conversation History: ${conversationHistory.userAIHistory.length} previous interactions`);

  try {
    const response = await makeChatGPTRequest(requestBody, apiKey);
    
    console.log('✅ ChatGPT API response received');
    console.log(`Response length: ${response.choices[0].message.content.length} characters`);
    console.log(`Tokens used: ${response.usage.prompt_tokens} input, ${response.usage.completion_tokens} output`);

    return {
      success: true,
      response: response.choices[0].message.content,
      metadata: {
        model: response.model,
        finishReason: response.choices[0].finish_reason,
        usage: response.usage
      }
    };
  } catch (error) {
    console.error('❌ ChatGPT API error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Build ChatGPT system message
 * @param {Object} context - Enhanced context object
 * @returns {string} - System message
 */
function buildChatGPTSystemMessage(context) {
  const {
    metadata,
    conversationHistory,
    contextualInsights,
    privacyMetadata
  } = context;

  let systemMessage = `You are ChatGPT, an advanced AI assistant integrated into the US-SPURS Multi-AI Collaborative System.

## Your Role:
You are responding to a GitHub issue in the ${metadata.repository.name} repository. You work alongside other AI systems (Claude, GitHub Copilot, Monica) in a collaborative environment.

## Task Context:
- Task Type: ${metadata.taskType}
- Priority: ${metadata.labels.find(l => l.startsWith('priority:')) || 'normal'}
- Project: ${metadata.repository.owner}/${metadata.repository.name}

## Response Guidelines:
1. Provide clear, actionable responses
2. Use markdown formatting for readability
3. Include practical examples and code when relevant
4. Consider user preferences and conversation history
5. Collaborate effectively with other AI systems when needed
6. Be concise but comprehensive

## Output Format:
Start your response with: ### 💬 ChatGPT Response

Then provide your solution in a well-structured format.`;

  // Add conversation history context
  if (conversationHistory.permissionsGranted && conversationHistory.userAIHistory.length > 0) {
    systemMessage += `\n\n## Conversation History:
You have ${conversationHistory.userAIHistory.length} previous interactions with this user.`;

    if (contextualInsights.userPreferences?.available) {
      const prefs = contextualInsights.userPreferences;
      systemMessage += `\n\n## User Communication Style:
- Prefers ${prefs.communicationStyle.preferredDetailLevel} responses
- Format preference: ${prefs.communicationStyle.preferredFormat}
- Technical level: ${prefs.communicationStyle.technicalDepth}`;
    }
  }

  // Add project context
  if (conversationHistory.permissionsGranted && contextualInsights.projectPatterns?.available) {
    const patterns = contextualInsights.projectPatterns;
    systemMessage += `\n\n## Project Context:
- Primary tech stack: ${Object.keys(patterns.technicalStack.languages).join(', ')}
- Collaborative work style: ${(patterns.aiUsagePatterns.collaborativeTasksRatio * 100).toFixed(0)}% multi-AI tasks`;
  }

  return systemMessage;
}

/**
 * Build ChatGPT user message
 * @param {Object} context - Enhanced context object
 * @returns {string} - User message
 */
function buildChatGPTUserMessage(context) {
  const { task, metadata, conversation } = context;

  let message = `# Issue #${metadata.issueNumber}: ${metadata.title}\n\n`;

  message += `## Description:\n${task.description}\n\n`;

  if (task.requirements.length > 0) {
    message += `## Requirements:\n`;
    task.requirements.forEach((req, i) => {
      message += `${i + 1}. ${req}\n`;
    });
    message += '\n';
  }

  if (task.technicalSpecs.language || task.technicalSpecs.framework) {
    message += `## Technical Details:\n`;
    if (task.technicalSpecs.language) message += `- Language: ${task.technicalSpecs.language}\n`;
    if (task.technicalSpecs.framework) message += `- Framework: ${task.technicalSpecs.framework}\n`;
    message += '\n';
  }

  if (conversation.timeline.length > 0) {
    message += `## Recent Discussion:\n`;
    conversation.timeline.slice(-3).forEach(comment => {
      message += `**${comment.author}**: ${comment.body.substring(0, 200)}${comment.body.length > 200 ? '...' : ''}\n\n`;
    });
  }

  message += `\nPlease provide a comprehensive solution.`;

  return message;
}

/**
 * Build conversation messages for ChatGPT
 * @param {Array} history - Conversation history
 * @param {string} systemMessage - System message
 * @param {string} currentMessage - Current user message
 * @returns {Array} - Array of messages
 */
function buildChatGPTConversationMessages(history, systemMessage, currentMessage) {
  const messages = [
    {
      role: 'system',
      content: systemMessage
    }
  ];

  // Add recent conversation history
  const recentHistory = history.slice(-3);

  for (const conv of recentHistory) {
    if (conv.messages && conv.messages.length > 0) {
      conv.messages.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content.substring(0, 1000) // Limit length
          });
        }
      });
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
 * Make HTTP request to OpenAI API
 * @param {Object} requestBody - Request body
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} - API response
 */
function makeChatGPTRequest(requestBody, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(requestBody);

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${apiKey}`
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
    callChatGPTAPI,
    buildChatGPTSystemMessage,
    buildChatGPTUserMessage,
    buildChatGPTConversationMessages,
    makeChatGPTRequest
  };
}
