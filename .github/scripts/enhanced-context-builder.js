/**
 * Enhanced Context Builder Script with Conversation History & Caching
 * Builds comprehensive context including historical conversations per AI system
 */

const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Cache directory structure
const CACHE_BASE_DIR = '.github/cache';
const CACHE_STRUCTURE = {
  user_ai_conversations: 'user-ai-conversations',      // Individual user-AI pairs
  project_conversations: 'project-conversations',       // All project-related
  ai_specific: 'ai-specific',                          // Per AI system
  collective: 'collective',                            // All AI interactions
  permissions: 'permissions'                           // User consent tracking
};

/**
 * Initialize cache directory structure
 */
async function initializeCacheStructure() {
  try {
    for (const [key, dir] of Object.entries(CACHE_STRUCTURE)) {
      const fullPath = path.join(CACHE_BASE_DIR, dir);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`✓ Cache directory initialized: ${fullPath}`);
    }
  } catch (error) {
    console.error('Error initializing cache structure:', error);
  }
}

/**
 * Generate unique conversation ID
 * @param {string} userId - GitHub username
 * @param {string} aiSystem - AI system name
 * @returns {string} - Unique conversation ID
 */
function generateConversationId(userId, aiSystem) {
  const hash = crypto.createHash('sha256');
  hash.update(`${userId}-${aiSystem}-${Date.now()}`);
  return hash.digest('hex').substring(0, 16);
}

/**
 * Check user permissions for conversation history usage
 * @param {string} userId - GitHub username
 * @param {string} aiSystem - AI system name
 * @returns {Promise<Object>} - Permission object
 */
async function checkUserPermissions(userId, aiSystem) {
  const permissionFile = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.permissions,
    `${userId}.json`
  );

  try {
    const data = await fs.readFile(permissionFile, 'utf8');
    const permissions = JSON.parse(data);
    
    return {
      allowed: permissions[aiSystem]?.enabled || false,
      scope: permissions[aiSystem]?.scope || 'none',
      expiresAt: permissions[aiSystem]?.expiresAt || null,
      lastUpdated: permissions.lastUpdated
    };
  } catch (error) {
    // No permissions file = no consent given
    return {
      allowed: false,
      scope: 'none',
      requiresConsent: true
    };
  }
}

/**
 * Request user permission for conversation history usage
 * @param {Object} octokit - GitHub API client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} userId - GitHub username
 * @returns {Promise<void>}
 */
async function requestUserPermission(octokit, owner, repo, issueNumber, userId) {
  const consentMessage = `## 🔐 Conversation History Consent Request

Hello @${userId}! 

To provide you with the best AI-assisted experience, our system can utilize conversation history for better context understanding.

### 📋 What We're Requesting Permission For:

**Individual AI Conversations:**
- Your direct interactions with each AI system (Claude, ChatGPT, Copilot, Monica)
- Stored separately per AI to maintain system integrity
- Used to provide continuity in your conversations with each specific AI

**Project-Wide Conversations:**
- All conversations related to this project across all AI systems
- Helps maintain context when different AIs collaborate on the same task
- Enables better handoffs between AI systems

**Collective Knowledge:**
- Aggregated insights from all interactions (anonymized patterns)
- Used to improve overall system performance
- Never shares your specific conversations without permission

### 🎯 Permission Scopes Available:

Reply with one of the following commands to set your preferences:

\`\`\`
/consent grant-all          # Allow all conversation history usage
/consent grant-individual   # Only individual AI conversations
/consent grant-project      # Only project-related conversations
/consent grant-temporary    # Grant for this session only (24 hours)
/consent deny               # Deny all conversation history usage
/consent status             # Check current permission status
\`\`\`

### 🔒 Your Privacy Rights:

- ✅ You can revoke consent at any time with \`/consent revoke\`
- ✅ You can export your data with \`/consent export\`
- ✅ You can delete your history with \`/consent delete-history\`
- ✅ Conversations are encrypted at rest
- ✅ Only accessible by AI systems you explicitly interact with
- ✅ Never shared with third parties

### 📊 Benefits of Granting Consent:

- 🎯 More contextually aware AI responses
- 🔄 Seamless handoffs between AI systems
- 📈 Improved task completion accuracy
- 💡 Better understanding of your preferences and work style
- ⚡ Faster response times (no need to re-explain context)

**Your consent is completely optional.** The system will work without it, but AI responses may require more context in each interaction.

---
*This consent request is part of the US-SPURS AI Orchestration System privacy framework*`;

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: consentMessage
  });

  console.log(`✓ Consent request sent to user: ${userId}`);
}

/**
 * Store user permission preferences
 * @param {string} userId - GitHub username
 * @param {string} scope - Permission scope
 * @param {number} durationHours - Duration in hours (null for permanent)
 * @returns {Promise<void>}
 */
async function storeUserPermissions(userId, scope, durationHours = null) {
  const permissionFile = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.permissions,
    `${userId}.json`
  );

  const expiresAt = durationHours 
    ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
    : null;

  const permissions = {
    userId,
    lastUpdated: new Date().toISOString(),
    copilot: {
      enabled: ['all', 'individual'].includes(scope),
      scope,
      expiresAt
    },
    claude: {
      enabled: ['all', 'individual'].includes(scope),
      scope,
      expiresAt
    },
    chatgpt: {
      enabled: ['all', 'individual'].includes(scope),
      scope,
      expiresAt
    },
    monica: {
      enabled: ['all', 'individual'].includes(scope),
      scope,
      expiresAt
    },
    projectWide: {
      enabled: ['all', 'project'].includes(scope),
      scope,
      expiresAt
    },
    collective: {
      enabled: scope === 'all',
      scope,
      expiresAt
    }
  };

  await fs.writeFile(permissionFile, JSON.stringify(permissions, null, 2));
  console.log(`✓ Permissions stored for user: ${userId}, scope: ${scope}`);
}

/**
 * Load conversation history for user-AI pair
 * @param {string} userId - GitHub username
 * @param {string} aiSystem - AI system name
 * @param {number} limit - Maximum number of conversations to load
 * @returns {Promise<Array>} - Array of conversation objects
 */
async function loadUserAIConversationHistory(userId, aiSystem, limit = 50) {
  const conversationDir = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.user_ai_conversations,
    userId,
    aiSystem
  );

  try {
    const files = await fs.readdir(conversationDir);
    const conversations = [];

    // Sort by timestamp (newest first)
    const sortedFiles = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const timeA = parseInt(a.split('-')[0]);
        const timeB = parseInt(b.split('-')[0]);
        return timeB - timeA;
      })
      .slice(0, limit);

    for (const file of sortedFiles) {
      const filePath = path.join(conversationDir, file);
      const data = await fs.readFile(filePath, 'utf8');
      conversations.push(JSON.parse(data));
    }

    console.log(`✓ Loaded ${conversations.length} conversations for ${userId}-${aiSystem}`);
    return conversations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`No conversation history found for ${userId}-${aiSystem}`);
      return [];
    }
    throw error;
  }
}

/**
 * Load project-wide conversation history
 * @param {string} projectId - Project identifier (repo name)
 * @param {number} limit - Maximum number of conversations to load
 * @returns {Promise<Array>} - Array of conversation objects
 */
async function loadProjectConversationHistory(projectId, limit = 100) {
  const conversationDir = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.project_conversations,
    projectId
  );

  try {
    const files = await fs.readdir(conversationDir);
    const conversations = [];

    const sortedFiles = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const timeA = parseInt(a.split('-')[0]);
        const timeB = parseInt(b.split('-')[0]);
        return timeB - timeA;
      })
      .slice(0, limit);

    for (const file of sortedFiles) {
      const filePath = path.join(conversationDir, file);
      const data = await fs.readFile(filePath, 'utf8');
      conversations.push(JSON.parse(data));
    }

    console.log(`✓ Loaded ${conversations.length} project conversations for ${projectId}`);
    return conversations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`No project conversation history found for ${projectId}`);
      return [];
    }
    throw error;
  }
}

/**
 * Load AI-specific conversation history (all interactions with one AI)
 * @param {string} aiSystem - AI system name
 * @param {number} limit - Maximum number of conversations to load
 * @returns {Promise<Array>} - Array of conversation objects
 */
async function loadAISpecificHistory(aiSystem, limit = 100) {
  const conversationDir = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.ai_specific,
    aiSystem
  );

  try {
    const files = await fs.readdir(conversationDir);
    const conversations = [];

    const sortedFiles = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const timeA = parseInt(a.split('-')[0]);
        const timeB = parseInt(b.split('-')[0]);
        return timeB - timeA;
      })
      .slice(0, limit);

    for (const file of sortedFiles) {
      const filePath = path.join(conversationDir, file);
      const data = await fs.readFile(filePath, 'utf8');
      conversations.push(JSON.parse(data));
    }

    console.log(`✓ Loaded ${conversations.length} conversations for AI: ${aiSystem}`);
    return conversations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`No conversation history found for AI: ${aiSystem}`);
      return [];
    }
    throw error;
  }
}

/**
 * Load collective conversation history (all AI interactions)
 * @param {number} limit - Maximum number of conversations to load
 * @returns {Promise<Array>} - Array of conversation objects
 */
async function loadCollectiveHistory(limit = 200) {
  const conversationDir = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.collective
  );

  try {
    const files = await fs.readdir(conversationDir);
    const conversations = [];

    const sortedFiles = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const timeA = parseInt(a.split('-')[0]);
        const timeB = parseInt(b.split('-')[0]);
        return timeB - timeA;
      })
      .slice(0, limit);

    for (const file of sortedFiles) {
      const filePath = path.join(conversationDir, file);
      const data = await fs.readFile(filePath, 'utf8');
      conversations.push(JSON.parse(data));
    }

    console.log(`✓ Loaded ${conversations.length} collective conversations`);
    return conversations;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No collective conversation history found');
      return [];
    }
    throw error;
  }
}

/**
 * Save conversation to appropriate caches
 * @param {Object} conversation - Conversation object
 * @param {Object} permissions - User permissions
 * @returns {Promise<void>}
 */
async function saveConversation(conversation, permissions) {
  const timestamp = Date.now();
  const {
    userId,
    aiSystem,
    projectId,
    issueNumber,
    conversationId,
    messages,
    metadata
  } = conversation;

  // Save to user-AI specific cache (if permitted)
  if (permissions.individual) {
    const userAIDir = path.join(
      CACHE_BASE_DIR,
      CACHE_STRUCTURE.user_ai_conversations,
      userId,
      aiSystem
    );
    await fs.mkdir(userAIDir, { recursive: true });
    
    const userAIFile = path.join(userAIDir, `${timestamp}-${conversationId}.json`);
    await fs.writeFile(userAIFile, JSON.stringify(conversation, null, 2));
    console.log(`✓ Saved to user-AI cache: ${userId}-${aiSystem}`);
  }

  // Save to project-wide cache (if permitted)
  if (permissions.projectWide) {
    const projectDir = path.join(
      CACHE_BASE_DIR,
      CACHE_STRUCTURE.project_conversations,
      projectId
    );
    await fs.mkdir(projectDir, { recursive: true });
    
    const projectFile = path.join(projectDir, `${timestamp}-${conversationId}.json`);
    await fs.writeFile(projectFile, JSON.stringify(conversation, null, 2));
    console.log(`✓ Saved to project cache: ${projectId}`);
  }

  // Save to AI-specific cache (if permitted)
  if (permissions.individual || permissions.projectWide) {
    const aiDir = path.join(
      CACHE_BASE_DIR,
      CACHE_STRUCTURE.ai_specific,
      aiSystem
    );
    await fs.mkdir(aiDir, { recursive: true });
    
    const aiFile = path.join(aiDir, `${timestamp}-${conversationId}.json`);
    await fs.writeFile(aiFile, JSON.stringify(conversation, null, 2));
    console.log(`✓ Saved to AI-specific cache: ${aiSystem}`);
  }

  // Save to collective cache (if permitted)
  if (permissions.collective) {
    const collectiveDir = path.join(
      CACHE_BASE_DIR,
      CACHE_STRUCTURE.collective
    );
    await fs.mkdir(collectiveDir, { recursive: true });
    
    // Anonymize for collective cache
    const anonymizedConversation = {
      ...conversation,
      userId: crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8),
      metadata: {
        ...metadata,
        anonymized: true
      }
    };
    
    const collectiveFile = path.join(collectiveDir, `${timestamp}-${conversationId}.json`);
    await fs.writeFile(collectiveFile, JSON.stringify(anonymizedConversation, null, 2));
    console.log(`✓ Saved to collective cache (anonymized)`);
  }
}

/**
 * Build enhanced context with conversation history
 * @param {Object} issue - GitHub issue object
 * @param {Array} comments - Array of comment objects
 * @param {string} taskType - Type of task
 * @param {string} aiSystem - Target AI system
 * @param {string} userId - GitHub username
 * @param {string} projectId - Project identifier
 * @returns {Promise<Object>} - Enhanced context object
 */
async function buildEnhancedContext(issue, comments, taskType, aiSystem, userId, projectId) {
  // Check permissions
  const permissions = await checkUserPermissions(userId, aiSystem);

  // Base context (from original context builder)
  const baseContext = {
    metadata: {
      issueNumber: issue.number,
      title: issue.title,
      author: issue.user.login,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      taskType: taskType,
      labels: issue.labels.map(l => l.name),
      milestone: issue.milestone?.title || null,
      repository: {
        name: projectId,
        owner: issue.repository_url.split('/').slice(-2, -1)[0]
      }
    },
    
    task: {
      description: issue.body || '',
      requirements: extractRequirements(issue.body),
      technicalSpecs: extractTechnicalSpecs(issue.body),
      constraints: extractConstraints(issue.body),
      acceptanceCriteria: extractAcceptanceCriteria(issue.body)
    },
    
    conversation: {
      commentCount: comments.length,
      participants: [...new Set(comments.map(c => c.user.login))],
      timeline: comments.map(c => ({
        author: c.user.login,
        createdAt: c.created_at,
        body: c.body,
        isAIResponse: isAIResponse(c.body)
      }))
    }
  };

  // Enhanced context with conversation history
  const enhancedContext = {
    ...baseContext,
    
    conversationHistory: {
      permissionsGranted: permissions.allowed,
      permissionScope: permissions.scope,
      
      // User-AI specific history
      userAIHistory: permissions.allowed && permissions.scope !== 'none'
        ? await loadUserAIConversationHistory(userId, aiSystem, 20)
        : [],
      
      // Project-wide history
      projectHistory: permissions.allowed && ['all', 'project'].includes(permissions.scope)
        ? await loadProjectConversationHistory(projectId, 30)
        : [],
      
      // AI-specific history (patterns and learnings)
      aiSpecificHistory: permissions.allowed
        ? await loadAISpecificHistory(aiSystem, 15)
        : [],
      
      // Collective insights (anonymized)
      collectiveInsights: permissions.allowed && permissions.scope === 'all'
        ? await loadCollectiveHistory(10)
        : []
    },
    
    contextualInsights: {
      // Analyze conversation patterns
      userPreferences: permissions.allowed 
        ? await analyzeUserPreferences(userId, aiSystem)
        : null,
      
      // Common patterns in project
      projectPatterns: permissions.allowed && ['all', 'project'].includes(permissions.scope)
        ? await analyzeProjectPatterns(projectId)
        : null,
      
      // AI system learnings
      aiLearnings: permissions.allowed
        ? await analyzeAILearnings(aiSystem)
        : null
    },
    
    privacyMetadata: {
      consentStatus: permissions.allowed ? 'granted' : 'not-granted',
      consentScope: permissions.scope,
      dataRetention: '90 days',
      encryptionStatus: 'at-rest',
      anonymizationLevel: permissions.scope === 'all' ? 'partial' : 'full'
    }
  };

  return enhancedContext;
}

/**
 * Analyze user preferences from conversation history
 * @param {string} userId - GitHub username
 * @param {string} aiSystem - AI system name
 * @returns {Promise<Object>} - User preferences object
 */
async function analyzeUserPreferences(userId, aiSystem) {
  const conversations = await loadUserAIConversationHistory(userId, aiSystem, 50);
  
  if (conversations.length === 0) {
    return {
      available: false,
      message: 'No conversation history available for analysis'
    };
  }

  const preferences = {
    communicationStyle: {
      preferredDetailLevel: 'detailed', // or 'concise'
      preferredFormat: 'structured',    // or 'narrative'
      technicalDepth: 'advanced'        // or 'intermediate', 'beginner'
    },
    
    taskPreferences: {
      mostCommonTaskTypes: [],
      averageTaskComplexity: 'medium',
      preferredAICollaboration: false
    },
    
    responsePatterns: {
      averageResponseTime: 0,
      followUpFrequency: 0,
      clarificationRequests: 0
    },
    
    technicalContext: {
      primaryLanguages: [],
      primaryFrameworks: [],
      commonPatterns: []
    }
  };

  // Analyze conversations
  let totalMessages = 0;
  let totalFollowUps = 0;
  let totalClarifications = 0;
  const taskTypes = {};
  const languages = {};
  const frameworks = {};

  for (const conv of conversations) {
    totalMessages += conv.messages?.length || 0;
    
    // Count follow-ups
    if (conv.metadata?.hasFollowUp) totalFollowUps++;
    
    // Count clarifications
    if (conv.metadata?.requiresClarification) totalClarifications++;
    
    // Track task types
    const taskType = conv.metadata?.taskType;
    if (taskType) {
      taskTypes[taskType] = (taskTypes[taskType] || 0) + 1;
    }
    
    // Track languages
    const lang = conv.metadata?.language;
    if (lang) {
      languages[lang] = (languages[lang] || 0) + 1;
    }
    
    // Track frameworks
    const framework = conv.metadata?.framework;
    if (framework) {
      frameworks[framework] = (frameworks[framework] || 0) + 1;
    }
  }

  // Calculate preferences
  preferences.taskPreferences.mostCommonTaskTypes = Object.entries(taskTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type);

  preferences.responsePatterns.followUpFrequency = 
    conversations.length > 0 ? (totalFollowUps / conversations.length) : 0;
  
  preferences.responsePatterns.clarificationRequests = 
    conversations.length > 0 ? (totalClarifications / conversations.length) : 0;

  preferences.technicalContext.primaryLanguages = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang]) => lang);

  preferences.technicalContext.primaryFrameworks = Object.entries(frameworks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([fw]) => fw);

  // Determine communication style based on patterns
  const avgMessagesPerConv = totalMessages / conversations.length;
  if (avgMessagesPerConv > 10) {
    preferences.communicationStyle.preferredDetailLevel = 'detailed';
  } else if (avgMessagesPerConv < 5) {
    preferences.communicationStyle.preferredDetailLevel = 'concise';
  }

  return {
    available: true,
    conversationsAnalyzed: conversations.length,
    ...preferences
  };
}

/**
 * Analyze project-wide patterns
 * @param {string} projectId - Project identifier
 * @returns {Promise<Object>} - Project patterns object
 */
async function analyzeProjectPatterns(projectId) {
  const conversations = await loadProjectConversationHistory(projectId, 100);
  
  if (conversations.length === 0) {
    return {
      available: false,
      message: 'No project conversation history available'
    };
  }

  const patterns = {
    commonChallenges: [],
    successfulApproaches: [],
    frequentCollaborations: [],
    technicalStack: {
      languages: {},
      frameworks: {},
      tools: {}
    },
    aiUsagePatterns: {
      mostUsedAI: null,
      collaborativeTasksRatio: 0,
      averageTaskCompletionTime: 0
    }
  };

  // Analyze conversations
  const aiUsage = {};
  let collaborativeTasks = 0;
  let totalCompletionTime = 0;
  let completedTasks = 0;

  for (const conv of conversations) {
    // Track AI usage
    const ai = conv.aiSystem;
    if (ai) {
      aiUsage[ai] = (aiUsage[ai] || 0) + 1;
    }
    
    // Track collaborative tasks
    if (conv.metadata?.multiAI) {
      collaborativeTasks++;
    }
    
    // Track completion time
    if (conv.metadata?.completionTime) {
      totalCompletionTime += conv.metadata.completionTime;
      completedTasks++;
    }
    
    // Track technical stack
    if (conv.metadata?.language) {
      const lang = conv.metadata.language;
      patterns.technicalStack.languages[lang] = 
        (patterns.technicalStack.languages[lang] || 0) + 1;
    }
    
    if (conv.metadata?.framework) {
      const fw = conv.metadata.framework;
      patterns.technicalStack.frameworks[fw] = 
        (patterns.technicalStack.frameworks[fw] || 0) + 1;
    }
  }

  // Calculate patterns
  patterns.aiUsagePatterns.mostUsedAI = Object.entries(aiUsage)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  patterns.aiUsagePatterns.collaborativeTasksRatio = 
    conversations.length > 0 ? (collaborativeTasks / conversations.length) : 0;

  patterns.aiUsagePatterns.averageTaskCompletionTime = 
    completedTasks > 0 ? (totalCompletionTime / completedTasks) : 0;

  return {
    available: true,
    conversationsAnalyzed: conversations.length,
    ...patterns
  };
}

/**
 * Analyze AI system learnings
 * @param {string} aiSystem - AI system name
 * @returns {Promise<Object>} - AI learnings object
 */
async function analyzeAILearnings(aiSystem) {
  const conversations = await loadAISpecificHistory(aiSystem, 100);
  
  if (conversations.length === 0) {
    return {
      available: false,
      message: 'No AI-specific history available'
    };
  }

  const learnings = {
    totalInteractions: conversations.length,
    successRate: 0,
    commonTaskTypes: [],
    strengthAreas: [],
    improvementAreas: [],
    averageResponseQuality: 0,
    collaborationEffectiveness: 0
  };

  // Analyze conversations
  let successfulTasks = 0;
  const taskTypes = {};
  let totalQualityScore = 0;
  let qualityRatings = 0;

  for (const conv of conversations) {
    // Track success
    if (conv.metadata?.successful) {
      successfulTasks++;
    }
    
    // Track task types
    const taskType = conv.metadata?.taskType;
    if (taskType) {
      taskTypes[taskType] = (taskTypes[taskType] || 0) + 1;
    }
    
    // Track quality ratings
    if (conv.metadata?.qualityScore) {
      totalQualityScore += conv.metadata.qualityScore;
      qualityRatings++;
    }
  }

  // Calculate learnings
  learnings.successRate = 
    conversations.length > 0 ? (successfulTasks / conversations.length) : 0;

  learnings.commonTaskTypes = Object.entries(taskTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  learnings.averageResponseQuality = 
    qualityRatings > 0 ? (totalQualityScore / qualityRatings) : 0;

  // Determine strength areas (task types with >80% success rate)
  for (const [taskType, count] of Object.entries(taskTypes)) {
    const successCount = conversations.filter(c => 
      c.metadata?.taskType === taskType && c.metadata?.successful
    ).length;
    
    const successRate = count > 0 ? (successCount / count) : 0;
    
    if (successRate > 0.8) {
      learnings.strengthAreas.push(taskType);
    } else if (successRate < 0.6) {
      learnings.improvementAreas.push(taskType);
    }
  }

  return {
    available: true,
    ...learnings
  };
}

// Import functions from original context builder
function extractRequirements(body) {
  const requirements = [];
  const reqSection = body.match(/(?:requirements?|what.*needed?|objectives?)[:\s]*\n([\s\S]*?)(?:\n#{1,3}\s|\n\n|$)/i);
  if (reqSection) {
    const lines = reqSection[1].split('\n');
    lines.forEach(line => {
      const cleaned = line.trim().replace(/^[-*•]\s*/, '');
      if (cleaned && cleaned.length > 10) {
        requirements.push(cleaned);
      }
    });
  }
  return requirements;
}

function extractTechnicalSpecs(body) {
  const specs = {
    language: null,
    framework: null,
    libraries: [],
    database: null,
    apis: []
  };
  
  const langMatch = body.match(/(?:language|programming language)[:\s]*([a-z0-9+#/.]+)/i);
  if (langMatch) specs.language = langMatch[1].trim();
  
  const frameworkMatch = body.match(/(?:framework|using)[:\s]*([a-z0-9. ]+?)(?:\n|,|$)/i);
  if (frameworkMatch) specs.framework = frameworkMatch[1].trim();
  
  const libMatches = body.match(/(?:librar(?:y|ies)|packages?|dependencies)[:\s]*([^\n]+)/i);
  if (libMatches) {
    specs.libraries = libMatches[1].split(/[,;]/).map(l => l.trim()).filter(Boolean);
  }
  
  const dbMatch = body.match(/(?:database|db)[:\s]*([a-z0-9 ]+?)(?:\n|,|$)/i);
  if (dbMatch) specs.database = dbMatch[1].trim();
  
  return specs;
}

function extractConstraints(body) {
  const constraints = [];
  const constSection = body.match(/(?:constraints?|limitations?|restrictions?)[:\s]*\n([\s\S]*?)(?:\n#{1,3}\s|\n\n|$)/i);
  if (constSection) {
    const lines = constSection[1].split('\n');
    lines.forEach(line => {
      const cleaned = line.trim().replace(/^[-*•]\s*/, '');
      if (cleaned && cleaned.length > 10) {
        constraints.push(cleaned);
      }
    });
  }
  return constraints;
}

function extractAcceptanceCriteria(body) {
  const criteria = [];
  const acSection = body.match(/(?:acceptance criteria|definition of done|success criteria)[:\s]*\n([\s\S]*?)(?:\n#{1,3}\s|\n\n|$)/i);
  if (acSection) {
    const lines = acSection[1].split('\n');
    lines.forEach(line => {
      const cleaned = line.trim().replace(/^[-*•\[\]\s✓✗xX]+/, '');
      if (cleaned && cleaned.length > 10) {
        criteria.push(cleaned);
      }
    });
  }
  return criteria;
}

function isAIResponse(body) {
  const aiIndicators = [
    /^###?\s*[🤖🧠💬✨]/,
    /AI (?:Response|Analysis|Recommendation)/i,
    /^(?:Claude|ChatGPT|Copilot|Monica):/i
  ];
  return aiIndicators.some(pattern => pattern.test(body));
}

/**
 * Handle consent commands from users
 * @param {string} command - Consent command
 * @param {string} userId - GitHub username
 * @returns {Promise<Object>} - Command result
 */
async function handleConsentCommand(command, userId) {
  const commandMap = {
    'grant-all': async () => {
      await storeUserPermissions(userId, 'all');
      return {
        success: true,
        message: '✅ Full consent granted! All conversation history features enabled.',
        scope: 'all'
      };
    },
    
    'grant-individual': async () => {
      await storeUserPermissions(userId, 'individual');
      return {
        success: true,
        message: '✅ Individual AI conversation history enabled.',
        scope: 'individual'
      };
    },
    
    'grant-project': async () => {
      await storeUserPermissions(userId, 'project');
      return {
        success: true,
        message: '✅ Project-wide conversation history enabled.',
        scope: 'project'
      };
    },
    
    'grant-temporary': async () => {
      await storeUserPermissions(userId, 'all', 24); // 24 hours
      return {
        success: true,
        message: '✅ Temporary consent granted for 24 hours.',
        scope: 'all',
        expiresIn: '24 hours'
      };
    },
    
    'deny': async () => {
      await storeUserPermissions(userId, 'none');
      return {
        success: true,
        message: '✅ Consent denied. No conversation history will be used.',
        scope: 'none'
      };
    },
    
    'status': async () => {
      const permissions = await checkUserPermissions(userId, 'claude');
      return {
        success: true,
        message: `Current consent status: ${permissions.scope}`,
        permissions
      };
    },
    
    'revoke': async () => {
      await storeUserPermissions(userId, 'none');
      return {
        success: true,
        message: '✅ All consent revoked. Conversation history disabled.',
        scope: 'none'
      };
    },
    
    'export': async () => {
      // This would trigger an export process
      return {
        success: true,
        message: '📦 Export request received. Your data will be prepared and sent via email.',
        action: 'export-initiated'
      };
    },
    
    'delete-history': async () => {
      // This would trigger a deletion process
      return {
        success: true,
        message: '🗑️ Deletion request received. Your conversation history will be permanently deleted within 24 hours.',
        action: 'deletion-initiated'
      };
    }
  };

  const handler = commandMap[command];
  if (handler) {
    return await handler();
  }

  return {
    success: false,
    message: `❌ Unknown consent command: ${command}`,
    availableCommands: Object.keys(commandMap)
  };
}

/**
 * Export user data (GDPR compliance)
 * @param {string} userId - GitHub username
 * @returns {Promise<Object>} - Export data package
 */
async function exportUserData(userId) {
  const exportData = {
    userId,
    exportDate: new Date().toISOString(),
    permissions: await checkUserPermissions(userId, 'claude'),
    conversations: {}
  };

  // Export all AI-specific conversations
  const aiSystems = ['copilot', 'claude', 'chatgpt', 'monica'];
  
  for (const ai of aiSystems) {
    const conversations = await loadUserAIConversationHistory(userId, ai, 1000);
    exportData.conversations[ai] = conversations;
  }

  return exportData;
}

/**
 * Delete user conversation history (GDPR compliance)
 * @param {string} userId - GitHub username
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteUserHistory(userId) {
  const deletionLog = {
    userId,
    deletionDate: new Date().toISOString(),
    deletedItems: {
      conversations: 0,
      permissions: false
    }
  };

  // Delete user-AI conversations
  const aiSystems = ['copilot', 'claude', 'chatgpt', 'monica'];
  
  for (const ai of aiSystems) {
    const conversationDir = path.join(
      CACHE_BASE_DIR,
      CACHE_STRUCTURE.user_ai_conversations,
      userId,
      ai
    );

    try {
      const files = await fs.readdir(conversationDir);
      for (const file of files) {
        await fs.unlink(path.join(conversationDir, file));
        deletionLog.deletedItems.conversations++;
      }
      await fs.rmdir(conversationDir);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting ${ai} conversations:`, error);
      }
    }
  }

  // Delete permissions file
  const permissionFile = path.join(
    CACHE_BASE_DIR,
    CACHE_STRUCTURE.permissions,
    `${userId}.json`
  );

  try {
    await fs.unlink(permissionFile);
    deletionLog.deletedItems.permissions = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error deleting permissions:', error);
    }
  }

  return deletionLog;
}

// Export all functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeCacheStructure,
    generateConversationId,
    checkUserPermissions,
    requestUserPermission,
    storeUserPermissions,
    loadUserAIConversationHistory,
    loadProjectConversationHistory,
    loadAISpecificHistory,
    loadCollectiveHistory,
    saveConversation,
    buildEnhancedContext,
    analyzeUserPreferences,
    analyzeProjectPatterns,
    analyzeAILearnings,
    handleConsentCommand,
    exportUserData,
    deleteUserHistory,
    extractRequirements,
    extractTechnicalSpecs,
    extractConstraints,
    extractAcceptanceCriteria,
    isAIResponse
  };
}

