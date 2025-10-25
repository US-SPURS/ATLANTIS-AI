/**
 * ATLANTIS-AI Express Server
 * Main server handling REST API, WebSocket connections, and AI orchestration
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');

const { initializeDatabase, seedSubAIAgents } = require('../scripts/init-database');
const AtlantisAI = require('./atlantis-ai');
const { SubAIManager } = require('./sub-ai-agents');
const GitHubWebhookHandler = require('./github-webhook-handler');
const GitHubProjectsIntegration = require('./github-projects-integration');

// Initialize Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Environment configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database
const db = initializeDatabase(process.env.DATABASE_PATH);
seedSubAIAgents(db);

// Initialize AI clients
const aiClients = {
  claude: null,
  openai: null
};

// Initialize Claude if API key is available
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
  const Anthropic = require('@anthropic-ai/sdk');
  aiClients.claude = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  console.log('✅ Claude AI client initialized');
}

// Initialize OpenAI if API key is available
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
  const { OpenAI } = require('openai');
  aiClients.openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI client initialized');
}

// Initialize ATLANTIS and Sub-AI Manager
const atlantis = new AtlantisAI(db, aiClients);
const subAIManager = new SubAIManager(db, aiClients);

// Initialize GitHub integrations
const webhookHandler = new GitHubWebhookHandler(
  db,
  atlantis,
  process.env.GITHUB_WEBHOOK_SECRET
);

const projectsIntegration = new GitHubProjectsIntegration(
  process.env.GITHUB_TOKEN,
  process.env.GITHUB_OWNER || 'US-SPURS',
  process.env.GITHUB_REPO || 'ATLANTIS-AI'
);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // For inline scripts in demo
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || 100)
});
app.use('/api/', limiter);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || 10485760) // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || '.pdf,.txt,.md,.json,.csv,.zip').split(',');
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// GitHub webhook endpoint
app.use('/github', webhookHandler.getRouter());

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    atlantis: 'online',
    subAIs: subAIManager.agents.size,
    aiClients: {
      claude: !!aiClients.claude,
      openai: !!aiClients.openai
    }
  });
});

// Create new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { userId, title, description, timeline, desiredOutcomes, availableResources, priority } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }

    // Get or create user
    let user = db.prepare('SELECT * FROM users WHERE github_username = ?').get(userId);
    if (!user) {
      const stmt = db.prepare('INSERT INTO users (github_username) VALUES (?)');
      const result = stmt.run(userId);
      user = { id: result.lastInsertRowid, github_username: userId };
    }

    const result = await atlantis.receiveTask({
      userId: user.id,
      title,
      description,
      timeline,
      desiredOutcomes,
      availableResources,
      priority
    });

    // Broadcast to WebSocket clients
    broadcastToClients({
      type: 'task-created',
      data: result
    });

    // Sync to GitHub Projects if enabled
    if (process.env.GITHUB_TOKEN) {
      const task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(result.taskId);
      await projectsIntegration.syncTaskToProject(task).catch(err => 
        console.error('GitHub Projects sync error:', err)
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task status
app.get('/api/tasks/:taskId', (req, res) => {
  try {
    const status = atlantis.getTaskStatus(req.params.taskId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks for a user
app.get('/api/users/:userId/tasks', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE github_username = ?').get(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tasks = db.prepare(`
      SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC
    `).all(user.id);

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Interact with ATLANTIS
app.post('/api/tasks/:taskId/interact', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await atlantis.interactWithUser(req.params.taskId, message);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sub-AI agents status
app.get('/api/agents', (req, res) => {
  try {
    const agents = subAIManager.getAgentsStatus();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get progress updates for a task
app.get('/api/tasks/:taskId/progress', (req, res) => {
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE task_id = ?').get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = db.prepare(`
      SELECT * FROM progress_updates 
      WHERE task_id = ? 
      ORDER BY created_at DESC
    `).all(task.id);

    res.json(updates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file for context
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userId, taskId } = req.body;

    // Get or create user
    let user = db.prepare('SELECT * FROM users WHERE github_username = ?').get(userId);
    if (!user) {
      const stmt = db.prepare('INSERT INTO users (github_username) VALUES (?)');
      const result = stmt.run(userId);
      user = { id: result.lastInsertRowid };
    }

    // Save file record
    const fileId = `file-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO uploaded_files (
        file_id, user_id, task_id, filename, original_name, 
        file_path, file_type, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const taskRecord = taskId ? db.prepare('SELECT id FROM tasks WHERE task_id = ?').get(taskId) : null;

    stmt.run(
      fileId,
      user.id,
      taskRecord?.id || null,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.mimetype,
      req.file.size
    );

    res.json({
      success: true,
      fileId,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get system metrics
app.get('/api/metrics', (req, res) => {
  try {
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    const completedTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = "completed"').get();
    const activeTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = "in-progress"').get();
    const totalWorkBots = db.prepare('SELECT COUNT(*) as count FROM work_bots').get();
    const agentLoad = db.prepare('SELECT SUM(current_load) as total FROM sub_ai_agents').get();

    res.json({
      tasks: {
        total: totalTasks.count,
        completed: completedTasks.count,
        active: activeTasks.count
      },
      workBots: totalWorkBots.count,
      agentLoad: agentLoad.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== WebSocket Handler =====
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket client connected');
  clients.add(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 WebSocket message:', data.type);

      if (data.type === 'subscribe-task') {
        ws.taskId = data.taskId;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    clients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to ATLANTIS-AI WebSocket'
  }));
});

function broadcastToClients(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Background task processor
setInterval(async () => {
  try {
    await subAIManager.processPendingAssignments();
  } catch (error) {
    console.error('Background processing error:', error);
  }
}, 10000); // Every 10 seconds

// Catch-all route - serve index.html for SPA
// Note: This route is not rate-limited as it serves static content
// and is necessary for client-side routing in single-page applications
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log('🌟 ATLANTIS-AI System Online');
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log(`🌐 Server:     http://localhost:${PORT}`);
  console.log(`🔌 WebSocket:  ws://localhost:${PORT}/ws`);
  console.log(`📊 API:        http://localhost:${PORT}/api`);
  console.log(`🤖 Sub-AIs:    ${subAIManager.agents.size} agents active`);
  console.log(`🧠 ATLANTIS:   Ready to receive tasks`);
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log('');
});

module.exports = { app, server, db, atlantis, subAIManager };
