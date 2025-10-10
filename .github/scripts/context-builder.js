/**
 * Context Builder Script
 * Builds comprehensive context for AI systems from GitHub issues
 */

const core = require('@actions/core');
const github = require('@actions/github');

/**
 * Build context for Claude AI
 * @param {Object} issue - GitHub issue object
 * @param {Array} comments - Array of comment objects
 * @param {string} taskType - Type of task
 * @returns {Object} - Structured context for Claude
 */
function buildClaudeContext(issue, comments, taskType) {
  const context = {
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
        name: issue.repository_url.split('/').slice(-1)[0],
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
    },
    
    codeContext: {
      codeBlocks: extractCodeBlocks(issue.body),
      fileReferences: extractFileReferences(issue.body),
      prReferences: extractPRReferences(issue.body)
    },
    
    priority: {
      level: extractPriorityLevel(issue.labels),
      deadline: extractDeadline(issue.body),
      urgency: calculateUrgency(issue)
    },
    
    relatedContext: {
      linkedIssues: extractLinkedIssues(issue.body),
      mentionedUsers: extractMentionedUsers(issue.body),
      tags: issue.labels.map(l => l.name)
    }
  };

  return context;
}

/**
 * Build context for ChatGPT
 * @param {Object} issue - GitHub issue object
 * @param {Array} comments - Array of comment objects
 * @param {string} taskType - Type of task
 * @returns {Object} - Structured context for ChatGPT
 */
function buildChatGPTContext(issue, comments, taskType) {
  const context = {
    task: {
      type: taskType,
      title: issue.title,
      description: issue.body || '',
      issueNumber: issue.number
    },
    
    requirements: {
      functional: extractRequirements(issue.body),
      technical: extractTechnicalSpecs(issue.body),
      constraints: extractConstraints(issue.body)
    },
    
    conversation: comments.map(c => ({
      author: c.user.login,
      timestamp: c.created_at,
      content: c.body
    })),
    
    metadata: {
      labels: issue.labels.map(l => l.name),
      priority: extractPriorityLevel(issue.labels),
      deadline: extractDeadline(issue.body),
      repository: issue.repository_url.split('/').slice(-2).join('/')
    },
    
    additionalContext: {
      codeExamples: extractCodeBlocks(issue.body),
      fileReferences: extractFileReferences(issue.body),
      linkedResources: extractLinkedIssues(issue.body)
    }
  };

  return context;
}

/**
 * Build context for GitHub Copilot
 * @param {Object} issue - GitHub issue object
 * @param {Array} comments - Array of comment objects
 * @param {string} taskType - Type of task
 * @returns {Object} - Structured context for Copilot
 */
function buildCopilotContext(issue, comments, taskType) {
  const context = {
    taskType: taskType,
    issueNumber: issue.number,
    title: issue.title,
    
    codeGeneration: {
      language: extractProgrammingLanguage(issue.body, issue.labels),
      framework: extractFramework(issue.body),
      requirements: extractRequirements(issue.body),
      existingCode: extractCodeBlocks(issue.body),
      fileTargets: extractFileReferences(issue.body)
    },
    
    specifications: {
      inputOutput: extractInputOutputSpecs(issue.body),
      dependencies: extractDependencies(issue.body),
      patterns: extractDesignPatterns(issue.body)
    },
    
    quality: {
      testRequirements: extractTestRequirements(issue.body),
      styleGuide: extractStyleGuide(issue.body),
      documentation: extractDocumentationRequirements(issue.body)
    },
    
    context: {
      repository: issue.repository_url,
      branch: extractBranch(issue.body),
      relatedFiles: extractFileReferences(issue.body)
    }
  };

  return context;
}

/**
 * Extract requirements from issue body
 * @param {string} body - Issue body text
 * @returns {Array} - Array of requirement strings
 */
function extractRequirements(body) {
  const requirements = [];
  
  // Look for requirements section
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
  
  // Look for bullet points with requirement keywords
  const reqRegex = /[-*•]\s*(?:must|should|need to|required to|has to)[^.\n]+[.\n]/gi;
  const matches = body.match(reqRegex);
  if (matches) {
    matches.forEach(match => {
      const cleaned = match.trim().replace(/^[-*•]\s*/, '');
      if (!requirements.includes(cleaned)) {
        requirements.push(cleaned);
      }
    });
  }
  
  return requirements;
}

/**
 * Extract technical specifications from issue body
 * @param {string} body - Issue body text
 * @returns {Object} - Technical specifications object
 */
function extractTechnicalSpecs(body) {
  const specs = {
    language: null,
    framework: null,
    libraries: [],
    database: null,
    apis: [],
    patterns: []
  };
  
  // Extract language
  const langMatch = body.match(/(?:language|programming language)[:\s]*([a-z0-9+#/.]+)/i);
  if (langMatch) specs.language = langMatch[1].trim();
  
  // Extract framework
  const frameworkMatch = body.match(/(?:framework|using)[:\s]*([a-z0-9. ]+?)(?:\n|,|$)/i);
  if (frameworkMatch) specs.framework = frameworkMatch[1].trim();
  
  // Extract libraries
  const libMatches = body.match(/(?:librar(?:y|ies)|packages?|dependencies)[:\s]*([^\n]+)/i);
  if (libMatches) {
    specs.libraries = libMatches[1].split(/[,;]/).map(l => l.trim()).filter(Boolean);
  }
  
  // Extract database
  const dbMatch = body.match(/(?:database|db)[:\s]*([a-z0-9 ]+?)(?:\n|,|$)/i);
  if (dbMatch) specs.database = dbMatch[1].trim();
  
  // Extract API references
  const apiMatches = body.match(/(?:api|rest|graphql|endpoint)[:\s]*([^\n]+)/gi);
  if (apiMatches) {
    apiMatches.forEach(match => {
      const api = match.split(':')[1]?.trim();
      if (api && !specs.apis.includes(api)) {
        specs.apis.push(api);
      }
    });
  }
  
  return specs;
}

/**
 * Extract constraints from issue body
 * @param {string} body - Issue body text
 * @returns {Array} - Array of constraint strings
 */
function extractConstraints(body) {
  const constraints = [];
  
  // Look for constraints section
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
  
  // Look for constraint keywords
  const constRegex = /[-*•]\s*(?:must not|cannot|should not|limited to|restricted to|maximum|minimum)[^.\n]+[.\n]/gi;
  const matches = body.match(constRegex);
  if (matches) {
    matches.forEach(match => {
      const cleaned = match.trim().replace(/^[-*•]\s*/, '');
      if (!constraints.includes(cleaned)) {
        constraints.push(cleaned);
      }
    });
  }
  
  return constraints;
}

/**
 * Extract acceptance criteria from issue body
 * @param {string} body - Issue body text
 * @returns {Array} - Array of acceptance criteria
 */
function extractAcceptanceCriteria(body) {
  const criteria = [];
  
  // Look for acceptance criteria section
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
      code: match[2].trim(),
      lineCount: match[2].trim().split('\n').length
    });
  }

  return blocks;
}

/**
 * Extract file references from text
 * @param {string} text - Text containing file references
 * @returns {Array} - Array of file paths
 */
function extractFileReferences(text) {
  const fileRegex = /(?:file|path|src|directory)[:\s]*([a-z0-9_\-./]+\.[a-z0-9]+)/gi;
  const files = [];
  let match;

  while ((match = fileRegex.exec(text)) !== null) {
    const file = match[1].trim();
    if (!files.includes(file)) {
      files.push(file);
    }
  }

  // Also look for inline code file paths
  const inlineFileRegex = /`([a-z0-9_\-./]+\.[a-z0-9]+)`/gi;
  while ((match = inlineFileRegex.exec(text)) !== null) {
    const file = match[1].trim();
    if (!files.includes(file)) {
      files.push(file);
    }
  }

  return files;
}

/**
 * Extract PR references from text
 * @param {string} text - Text containing PR references
 * @returns {Array} - Array of PR numbers
 */
function extractPRReferences(text) {
  const prRegex = /#(\d+)|pull\/(\d+)|PR[:\s]*(\d+)/gi;
  const prs = [];
  let match;

  while ((match = prRegex.exec(text)) !== null) {
    const prNumber = match[1] || match[2] || match[3];
    if (prNumber && !prs.includes(prNumber)) {
      prs.push(prNumber);
    }
  }

  return prs;
}

/**
 * Extract linked issues from text
 * @param {string} text - Text containing issue links
 * @returns {Array} - Array of issue numbers
 */
function extractLinkedIssues(text) {
  const issueRegex = /#(\d+)|issues?\/(\d+)/gi;
  const issues = [];
  let match;

  while ((match = issueRegex.exec(text)) !== null) {
    const issueNumber = match[1] || match[2];
    if (issueNumber && !issues.includes(issueNumber)) {
      issues.push(issueNumber);
    }
  }

  return issues;
}

/**
 * Extract mentioned users from text
 * @param {string} text - Text containing user mentions
 * @returns {Array} - Array of usernames
 */
function extractMentionedUsers(text) {
  const userRegex = /@([a-z0-9_-]+)/gi;
  const users = [];
  let match;

  // Exclude AI mentions
  const aiNames = ['copilot', 'claude', 'chatgpt', 'monica', 'multi', 'all-ai'];

  while ((match = userRegex.exec(text)) !== null) {
    const username = match[1].toLowerCase();
    if (!aiNames.includes(username) && !users.includes(username)) {
      users.push(username);
    }
  }

  return users;
}

/**
 * Extract priority level from labels
 * @param {Array} labels - Array of label objects
 * @returns {string} - Priority level
 */
function extractPriorityLevel(labels) {
  const priorityLabel = labels.find(l => l.name.startsWith('priority:'));
  if (priorityLabel) {
    return priorityLabel.name.replace('priority:', '');
  }
  return 'normal';
}

/**
 * Extract deadline from text
 * @param {string} text - Text containing deadline information
 * @returns {string|null} - Deadline date or null
 */
function extractDeadline(text) {
  const deadlineRegex = /(?:deadline|due|needed by|target date)[:\s]*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  const match = text.match(deadlineRegex);
  return match ? match[1] : null;
}

/**
 * Calculate urgency score
 * @param {Object} issue - GitHub issue object
 * @returns {number} - Urgency score (0-100)
 */
function calculateUrgency(issue) {
  let score = 50;

  const labels = issue.labels.map(l => l.name.toLowerCase());
  
  if (labels.includes('priority:critical')) score = 100;
  else if (labels.includes('priority:high')) score = 75;
  else if (labels.includes('priority:low')) score = 25;
  
  if (labels.includes('security')) score += 20;
  if (labels.includes('bug')) score += 10;
  
  // Age factor
  const age = Date.now() - new Date(issue.created_at).getTime();
  const ageDays = age / (1000 * 60 * 60 * 24);
  if (ageDays > 7) score += 5;
  if (ageDays > 14) score += 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Check if comment is an AI response
 * @param {string} body - Comment body text
 * @returns {boolean} - True if AI response
 */
function isAIResponse(body) {
  const aiIndicators = [
    /^###?\s*[🤖🧠💬✨]/,
    /AI (?:Response|Analysis|Recommendation)/i,
    /^(?:Claude|ChatGPT|Copilot|Monica):/i
  ];

  return aiIndicators.some(pattern => pattern.test(body));
}

/**
 * Extract programming language
 * @param {string} body - Issue body text
 * @param {Array} labels - Issue labels
 * @returns {string|null} - Programming language
 */
function extractProgrammingLanguage(body, labels) {
  // Check labels first
  const langLabel = labels.find(l => l.name.startsWith('lang:'));
  if (langLabel) {
    return langLabel.name.replace('lang:', '');
  }

  // Check body
  const langMatch = body.match(/(?:language|programming language)[:\s]*([a-z0-9+#/.]+)/i);
  if (langMatch) return langMatch[1].trim();

  // Check code blocks
  const codeBlocks = extractCodeBlocks(body);
  if (codeBlocks.length > 0 && codeBlocks[0].language !== 'text') {
    return codeBlocks[0].language;
  }

  return null;
}

/**
 * Extract framework information
 * @param {string} body - Issue body text
 * @returns {string|null} - Framework name
 */
function extractFramework(body) {
  const frameworkMatch = body.match(/(?:framework|using)[:\s]*([a-z0-9. ]+?)(?:\n|,|with|$)/i);
  return frameworkMatch ? frameworkMatch[1].trim() : null;
}

/**
 * Extract input/output specifications
 * @param {string} body - Issue body text
 * @returns {Object} - Input/output specs
 */
function extractInputOutputSpecs(body) {
  const specs = {
    input: null,
    output: null
  };

  const inputSection = body.match(/(?:input|expected input)[:\s]*\n([\s\S]*?)(?:\n#{1,3}\s|output|\n\n|$)/i);
  if (inputSection) {
    specs.input = inputSection[1].trim();
  }

  const outputSection = body.match(/(?:output|expected output)[:\s]*\n([\s\S]*?)(?:\n#{1,3}\s|\n\n|$)/i);
  if (outputSection) {
    specs.output = outputSection[1].trim();
  }

  return specs;
}

/**
 * Extract dependencies
 * @param {string} body - Issue body text
 * @returns {Array} - Array of dependencies
 */
function extractDependencies(body) {
  const deps = [];
  
  const depsSection = body.match(/(?:dependencies|packages?|libraries)[:\s]*\n([\s\S]*?)(?:\n#{1,3}\s|\n\n|$)/i);
  if (depsSection) {
    const lines = depsSection[1].split('\n');
    lines.forEach(line => {
      const cleaned = line.trim().replace(/^[-*•]\s*/, '');
      if (cleaned && cleaned.length > 2) {
        deps.push(cleaned);
      }
    });
  }

  return deps;
}

/**
 * Extract design patterns
 * @param {string} body - Issue body text
 * @returns {Array} - Array of design patterns
 */
function extractDesignPatterns(body) {
  const patterns = [];
  const patternKeywords = [
    'singleton', 'factory', 'observer', 'strategy', 'decorator',
    'adapter', 'facade', 'proxy', 'mvc', 'mvvm', 'repository'
  ];

  patternKeywords.forEach(pattern => {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(body)) {
      patterns.push(pattern);
    }
  });

  return patterns;
}

/**
 * Extract test requirements
 * @param {string} body - Issue body text
 * @returns {Object} - Test requirements
 */
function extractTestRequirements(body) {
  const requirements = {
    unitTests: false,
    integrationTests: false,
    e2eTests: false,
    coverage: null,
    framework: null
  };

  if (/unit test/i.test(body)) requirements.unitTests = true;
  if (/integration test/i.test(body)) requirements.integrationTests = true;
  if (/e2e|end-to-end/i.test(body)) requirements.e2eTests = true;

  const coverageMatch = body.match(/(?:coverage|test coverage)[:\s]*(\d+)%/i);
  if (coverageMatch) requirements.coverage = parseInt(coverageMatch[1]);

  const frameworkMatch = body.match(/(?:test framework|testing)[:\s]*([a-z0-9]+)/i);
  if (frameworkMatch) requirements.framework = frameworkMatch[1];

  return requirements;
}

/**
 * Extract style guide information
 * @param {string} body - Issue body text
 * @returns {string|null} - Style guide reference
 */
function extractStyleGuide(body) {
  const styleMatch = body.match(/(?:style guide|coding standard|eslint|prettier)[:\s]*([^\n]+)/i);
  return styleMatch ? styleMatch[1].trim() : null;
}

/**
 * Extract documentation requirements
 * @param {string} body - Issue body text
 * @returns {Object} - Documentation requirements
 */
function extractDocumentationRequirements(body) {
  const requirements = {
    inline: /inline comment|code comment/i.test(body),
    jsdoc: /jsdoc|javadoc|docstring/i.test(body),
    readme: /readme|documentation/i.test(body),
    api: /api doc/i.test(body)
  };

  return requirements;
}

/**
 * Extract branch information
 * @param {string} body - Issue body text
 * @returns {string|null} - Branch name
 */
function extractBranch(body) {
  const branchMatch = body.match(/(?:branch)[:\s]*([a-z0-9_\-./]+)/i);
  return branchMatch ? branchMatch[1].trim() : null;
}

// Export functions for use in GitHub Actions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildClaudeContext,
    buildChatGPTContext,
    buildCopilotContext,
    extractRequirements,
    extractTechnicalSpecs,
    extractConstraints,
    extractAcceptanceCriteria,
    extractCodeBlocks,
    extractFileReferences,
    extractPRReferences,
    extractLinkedIssues,
    extractMentionedUsers,
    extractPriorityLevel,
    extractDeadline,
    calculateUrgency,
    isAIResponse,
    extractProgrammingLanguage,
    extractFramework,
    extractInputOutputSpecs,
    extractDependencies,
    extractDesignPatterns,
    extractTestRequirements,
    extractStyleGuide,
    extractDocumentationRequirements,
    extractBranch
  };
}
