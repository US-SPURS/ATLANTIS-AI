/**
 * Database Schema for ATLANTIS-AI System
 * SQLite database for easy setup with upgrade path to PostgreSQL
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Initialize the ATLANTIS-AI database
 * @param {string} dbPath - Path to database file
 * @returns {Object} - Database instance
 */
function initializeDatabase(dbPath = './database/atlantis.db') {
  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('🗄️  Initializing ATLANTIS-AI Database...');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_username TEXT UNIQUE NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      preferences TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tasks table - tracks all tasks assigned to ATLANTIS
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      intent TEXT,
      timeline TEXT,
      desired_outcomes TEXT,
      available_resources TEXT,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Sub-AI Agents table - 12 specialized AI agents
  db.exec(`
    CREATE TABLE IF NOT EXISTS sub_ai_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      expertise_areas TEXT,
      status TEXT DEFAULT 'active',
      current_load INTEGER DEFAULT 0,
      max_capacity INTEGER DEFAULT 10,
      performance_score REAL DEFAULT 100.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Task Assignments - Links tasks to sub-AI agents
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id TEXT UNIQUE NOT NULL,
      task_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      assigned_elements TEXT,
      status TEXT DEFAULT 'assigned',
      progress INTEGER DEFAULT 0,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (agent_id) REFERENCES sub_ai_agents(id)
    )
  `);

  // Work Bots table - Bots created by sub-AIs
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT UNIQUE NOT NULL,
      assignment_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      bot_type TEXT NOT NULL,
      task_description TEXT,
      status TEXT DEFAULT 'created',
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (assignment_id) REFERENCES task_assignments(id),
      FOREIGN KEY (agent_id) REFERENCES sub_ai_agents(id)
    )
  `);

  // Project Plans - ATLANTIS-generated project plans
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT UNIQUE NOT NULL,
      task_id INTEGER NOT NULL,
      plan_data TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      approved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Conversations - AI interaction history
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      task_id INTEGER,
      ai_system TEXT NOT NULL,
      messages TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Uploaded Files - Context files uploaded by users
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      task_id INTEGER,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      extracted_content TEXT,
      embeddings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Progress Updates - Real-time progress tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id TEXT UNIQUE NOT NULL,
      task_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      message TEXT NOT NULL,
      progress_percentage INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // User Permissions - Consent and privacy settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ai_system TEXT NOT NULL,
      permission_scope TEXT NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      revoked BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, ai_system)
    )
  `);

  // System Metrics - Performance tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value TEXT NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_assignments_agent_id ON task_assignments(agent_id);
    CREATE INDEX IF NOT EXISTS idx_work_bots_assignment_id ON work_bots(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_task_id ON conversations(task_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_task_id ON uploaded_files(task_id);
    CREATE INDEX IF NOT EXISTS idx_progress_updates_task_id ON progress_updates(task_id);
  `);

  console.log('✅ Database schema initialized');

  return db;
}

/**
 * Seed initial sub-AI agents
 * @param {Object} db - Database instance
 */
function seedSubAIAgents(db) {
  console.log('🌱 Seeding Sub-AI Agents...');

  const subAIs = [
    {
      agent_id: 'sub-ai-code',
      name: 'Code Architect',
      specialization: 'Code Development',
      expertise_areas: JSON.stringify(['JavaScript', 'Python', 'Java', 'TypeScript', 'Go', 'Rust', 'C#'])
    },
    {
      agent_id: 'sub-ai-architecture',
      name: 'System Architect',
      specialization: 'Software Architecture',
      expertise_areas: JSON.stringify(['Microservices', 'Monoliths', 'Event-Driven', 'Serverless', 'Design Patterns'])
    },
    {
      agent_id: 'sub-ai-testing',
      name: 'Quality Assurance',
      specialization: 'Testing & QA',
      expertise_areas: JSON.stringify(['Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance Testing'])
    },
    {
      agent_id: 'sub-ai-security',
      name: 'Security Guardian',
      specialization: 'Security & Compliance',
      expertise_areas: JSON.stringify(['Vulnerability Assessment', 'Penetration Testing', 'Security Audits', 'Compliance'])
    },
    {
      agent_id: 'sub-ai-docs',
      name: 'Documentation Expert',
      specialization: 'Documentation',
      expertise_areas: JSON.stringify(['API Docs', 'User Guides', 'Technical Writing', 'Architecture Diagrams'])
    },
    {
      agent_id: 'sub-ai-devops',
      name: 'DevOps Engineer',
      specialization: 'DevOps & CI/CD',
      expertise_areas: JSON.stringify(['Docker', 'Kubernetes', 'GitHub Actions', 'Jenkins', 'Terraform'])
    },
    {
      agent_id: 'sub-ai-datascience',
      name: 'Data Scientist',
      specialization: 'Data Science & ML',
      expertise_areas: JSON.stringify(['Machine Learning', 'Data Analysis', 'Neural Networks', 'NLP', 'Computer Vision'])
    },
    {
      agent_id: 'sub-ai-uiux',
      name: 'UI/UX Designer',
      specialization: 'User Interface & Experience',
      expertise_areas: JSON.stringify(['React', 'Vue', 'Angular', 'Design Systems', 'Accessibility'])
    },
    {
      agent_id: 'sub-ai-backend',
      name: 'Backend Specialist',
      specialization: 'Backend Development',
      expertise_areas: JSON.stringify(['REST APIs', 'GraphQL', 'Databases', 'Caching', 'Message Queues'])
    },
    {
      agent_id: 'sub-ai-frontend',
      name: 'Frontend Specialist',
      specialization: 'Frontend Development',
      expertise_areas: JSON.stringify(['HTML/CSS', 'JavaScript', 'Responsive Design', 'PWAs', 'Performance'])
    },
    {
      agent_id: 'sub-ai-database',
      name: 'Database Expert',
      specialization: 'Database Design & Optimization',
      expertise_areas: JSON.stringify(['SQL', 'NoSQL', 'Query Optimization', 'Data Modeling', 'Migrations'])
    },
    {
      agent_id: 'sub-ai-api',
      name: 'API Designer',
      specialization: 'API Design & Integration',
      expertise_areas: JSON.stringify(['REST', 'GraphQL', 'gRPC', 'WebSockets', 'API Security'])
    }
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO sub_ai_agents (agent_id, name, specialization, expertise_areas)
    VALUES (@agent_id, @name, @specialization, @expertise_areas)
  `);

  const insertMany = db.transaction((agents) => {
    for (const agent of agents) {
      insert.run(agent);
    }
  });

  insertMany(subAIs);
  console.log('✅ Sub-AI Agents seeded');
}

module.exports = {
  initializeDatabase,
  seedSubAIAgents
};
