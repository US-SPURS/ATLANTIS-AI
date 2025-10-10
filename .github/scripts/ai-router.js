/**
 * AI Router Script
 * Routes tasks to appropriate AI systems based on mentions, labels, and content
 */

const core = require('@actions/core');
const github = require('@actions/github');

/**
 * Parse AI mentions from text
 * @param {string} text - Text to parse for AI mentions
 * @returns {Object} - Object containing boolean flags for each AI
 */
function parseAIMentions(text) {
  const mentions = {
    copilot: false,
    claude: false,
    chatgpt: false,
    monica: false,
    multi: false,
    commands: {}
  };

  // Check for basic mentions
  if (/@copilot(?:\s|$|[^\w-])/i.test(text)) mentions.copilot = true;
  if (/@claude(?:\s|$|[^\w-])/i.test(text)) mentions.claude = true;
  if (/@chatgpt(?:\s|$|[^\w-])/i.test(text)) mentions.chatgpt = true;
  if (/@monica(?:\s|$|[^\w-])/i.test(text)) mentions.monica = true;
  if (/@multi(?:\s|$|[^\w-])/i.test(text) || /@all-ai/i.test(text)) {
    mentions.multi = true;
    mentions.copilot = true;
    mentions.claude = true;
    mentions.chatgpt = true;
  }

  // Parse specific commands
  const copilotCommandMatch = text.match(/@copilot-(\w+)/i);
  const claudeCommandMatch = text.match(/@claude-(\w+)/i);
  const chatgptCommandMatch = text.match(/@chatgpt-(\w+)/i);
  const monicaCommandMatch = text.match(/@monica-(\w+)/i);

  if (copilotCommandMatch) {
    mentions.copilot = true;
    mentions.commands.copilot = copilotCommandMatch[1].toLowerCase();
  }
  if (claudeCommandMatch) {
    mentions.claude = true;
    mentions.commands.claude = claudeCommandMatch[1].toLowerCase();
  }
  if (chatgptCommandMatch) {
    mentions.chatgpt = true;
    mentions.commands.chatgpt = chatgptCommandMatch[1].toLowerCase();
  }
  if (monicaCommandMatch) {
    mentions.monica = true;
    mentions.commands.monica = monicaCommandMatch[1].toLowerCase();
  }

  return mentions;
}

/**
 * Determine task type from labels and content
 * @param {Object} payload - GitHub webhook payload
 * @param {string} text - Issue/PR body text
 * @returns {string} - Task type identifier
 */
function determineTaskType(payload, text) {
  const labels = payload.issue?.labels || payload.pull_request?.labels || [];
  const labelNames = labels.map(l => l.name.toLowerCase());

  // Check explicit type labels first
  const typeMapping = {
    'type:code-generation': 'code-generation',
    'type:analysis': 'technical-analysis',
    'type:content': 'content-creation',
    'type:code-review': 'code-review',
    'type:architecture': 'architecture-design',
    'type:bug': 'bug-investigation',
    'type:documentation': 'documentation',
    'type:security': 'security-audit',
    'type:performance': 'performance-optimization'
  };

  for (const [label, type] of Object.entries(typeMapping)) {
    if (labelNames.includes(label)) {
      return type;
    }
  }

  // Fallback: analyze content
  const contentPatterns = {
    'code-generation': /\b(generate|create|build|implement|develop|code|function|class|module)\b/i,
    'technical-analysis': /\b(analyze|review|assess|evaluate|investigate|examine|study)\b/i,
    'content-creation': /\b(write|document|explain|describe|guide|tutorial|article|blog)\b/i,
    'code-review': /\b(review|critique|feedback|improve|refactor|optimize)\b.*\b(code|pr|pull request)\b/i,
    'architecture-design': /\b(architecture|design|structure|pattern|system|infrastructure)\b/i,
    'bug-investigation': /\b(bug|error|issue|problem|fix|debug|troubleshoot)\b/i,
    'security-audit': /\b(security|vulnerability|exploit|audit|penetration|threat)\b/i,
    'performance-optimization': /\b(performance|optimize|speed|efficiency|benchmark|profile)\b/i
  };

  for (const [type, pattern] of Object.entries(contentPatterns)) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return 'general';
}

/**
 * Determine optimal AI for task type
 * @param {string} taskType - Type of task
 * @returns {Object} - Recommended AI assignments
 */
function getOptimalAIForTask(taskType) {
  const aiRecommendations = {
    'code-generation': {
      primary: 'copilot',
      secondary: ['claude'],
      reasoning: 'Copilot excels at code generation with IDE integration'
    },
    'technical-analysis': {
      primary: 'claude',
      secondary: ['chatgpt'],
      reasoning: 'Claude provides deep technical analysis and reasoning'
    },
    'content-creation': {
      primary: 'chatgpt',
      secondary: ['claude'],
      reasoning: 'ChatGPT excels at natural language content generation'
    },
    'code-review': {
      primary: 'multi',
      secondary: ['claude', 'copilot'],
      reasoning: 'Multiple perspectives provide comprehensive review'
    },
    'architecture-design': {
      primary: 'claude',
      secondary: ['chatgpt'],
      reasoning: 'Claude handles complex system design well'
    },
    'bug-investigation': {
      primary: 'claude',
      secondary: ['copilot'],
      reasoning: 'Claude provides thorough debugging analysis'
    },
    'security-audit': {
      primary: 'claude',
      secondary: ['copilot'],
      reasoning: 'Claude offers comprehensive security analysis'
    },
    'performance-optimization': {
      primary: 'claude',
      secondary: ['copilot'],
      reasoning: 'Claude analyzes performance bottlenecks effectively'
    },
    'general': {
      primary: 'claude',
      secondary: ['chatgpt'],
      reasoning: 'Claude handles general tasks well'
    }
  };

  return aiRecommendations[taskType] || aiRecommendations['general'];
}

/**
 * Calculate task priority score
 * @param {Object} payload - GitHub webhook payload
 * @returns {number} - Priority score (0-100)
 */
function calculatePriorityScore(payload) {
  const labels = payload.issue?.labels || payload.pull_request?.labels || [];
  const labelNames = labels.map(l => l.name.toLowerCase());

  let score = 50; // Default normal priority

  // Priority labels
  if (labelNames.includes('priority:critical')) score = 100;
  else if (labelNames.includes('priority:high')) score = 75;
  else if (labelNames.includes('priority:normal')) score = 50;
  else if (labelNames.includes('priority:low')) score = 25;

  // Boost for certain conditions
  if (labelNames.includes('security')) score += 20;
  if (labelNames.includes('bug')) score += 10;
  if (payload.issue?.milestone) score += 10;

  // Age factor (older issues get slight boost)
  if (payload.issue?.created_at) {
    const age = Date.now() - new Date(payload.issue.created_at).getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);
    if (ageDays > 7) score += 5;
    if (ageDays > 14) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Extract code blocks from text
 * @param {string} text - Text containing code blocks
 * @returns {Array} - Array of code block objects
 */
function extractCodeBlocks(text) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }

  return blocks;
}

/**
 * Build routing decision
 * @param {Object} payloa
