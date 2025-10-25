# 🌟 ATLANTIS-AI

> **Advanced Hierarchical AI Orchestration System**  
> A revolutionary AI platform featuring a master coordinator (ATLANTIS) that delegates tasks to 12 specialized sub-AI agents, which in turn create and manage work bots for intelligent task execution.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://us-spurs.github.io/ATLANTIS-AI)

## 🎯 Overview

ATLANTIS-AI is a cutting-edge AI orchestration system that brings together multiple AI technologies in a hierarchical, collaborative framework. At its core is **ATLANTIS**, the master AI coordinator that:

1. 🧠 **Understands user intent** through natural language processing
2. 📋 **Creates comprehensive project plans** with timeline and resource allocation
3. 🎯 **Delegates tasks** to specialized sub-AI agents
4. 📊 **Monitors progress** and provides real-time updates
5. 💬 **Interacts with users** for clarification and status updates

### Key Features

- ✨ **Drag-and-Drop UI**: Intuitive interface for task creation
- 🗣️ **Natural Language Input**: Describe tasks in plain English
- 📎 **File Upload & Context Learning**: Upload documents for AI context
- 🤖 **12 Specialized Sub-AIs**: Expert agents for different domains
- 🔧 **Autonomous Work Bots**: Sub-AIs create bots for specific tasks
- 🔄 **Real-time Updates**: WebSocket-powered live progress tracking
- 📊 **Comprehensive Dashboard**: Track all tasks and AI agents
- 🔐 **Secure & Private**: Built-in authentication and data protection

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     👤 User Interface                    │
│  ┌────────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ Dashboard  │  │ Task UI  │  │  Chat with ATLANTIS │ │
│  └────────────┘  └──────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              🌟 ATLANTIS Master AI Coordinator           │
│  • Intent Understanding  • Project Planning              │
│  • Task Delegation      • Progress Monitoring            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                🤖 12 Specialized Sub-AI Agents           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Code   │ │  System  │ │  Quality │ │ Security │  │
│  │Architect │ │Architect │ │Assurance │ │ Guardian │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Docs   │ │  DevOps  │ │   Data   │ │  UI/UX   │  │
│  │  Expert  │ │ Engineer │ │Scientist │ │ Designer │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Backend  │ │ Frontend │ │ Database │ │   API    │  │
│  │Specialist│ │Specialist│ │  Expert  │ │ Designer │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   🔧 Work Bots (Auto-Created)            │
│  Small, focused task execution units created by Sub-AIs  │
│  • Research Bots  • Code Gen Bots  • Test Bots          │
│  • Deploy Bots    • Analysis Bots  • Documentation Bots │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- API Keys (optional but recommended):
  - Anthropic API Key (for Claude AI)
  - OpenAI API Key (for ChatGPT/GPT-4)

### Installation

```bash
# Clone the repository
git clone https://github.com/US-SPURS/ATLANTIS-AI.git
cd ATLANTIS-AI

# Run the setup wizard
npm run setup

# Or manual installation:
npm install
cp .env.example .env
# Edit .env with your API keys
npm run db:init

# Start the server
npm start
```

### Access the Application

Open your browser and navigate to:
- **Main App**: http://localhost:3000
- **API Docs**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3000/ws

## 📖 Usage Guide

### Creating Your First Task

1. **Enter Username**: Provide your GitHub username in the header
2. **Navigate to "Create Task"**
3. **Describe Your Task**: Use natural language to explain what you need
4. **Drag Components**: Select relevant components (Frontend, Backend, etc.)
5. **Upload Context Files**: Add any relevant documentation or code
6. **Submit**: ATLANTIS will analyze and delegate to appropriate sub-AIs

### Example Task

```
Title: Build User Authentication System

Description: I need a complete user authentication system with:
- JWT token-based authentication
- User registration and login
- Password reset functionality
- Email verification
- Role-based access control
- Integration with PostgreSQL

Timeline: 2 weeks
Priority: High

Components: Backend API, Database, Security, Testing, Documentation
```

### Monitoring Progress

- View real-time updates in the dashboard
- Click on tasks to see detailed progress
- Chat with ATLANTIS for status updates
- Receive WebSocket notifications for major milestones

## 🛠️ Technology Stack

### Backend
- **Node.js** + **Express.js**: RESTful API server
- **better-sqlite3**: Fast, embedded database
- **WebSocket (ws)**: Real-time communication
- **Anthropic SDK**: Claude AI integration
- **OpenAI SDK**: GPT-4 integration

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Modern CSS3**: Gradients, animations, flexbox/grid
- **HTML5**: Semantic markup
- **WebSocket API**: Real-time updates

### AI Integration
- **Claude Sonnet 4.5**: Primary AI for understanding and planning
- **GPT-4**: Alternative AI for specific tasks
- **Custom AI Routing**: Intelligent task delegation

### DevOps
- **GitHub Actions**: CI/CD workflows
- **GitHub Pages**: Documentation hosting
- **GitHub Webhooks**: Event-driven automation

## 📁 Project Structure

```
ATLANTIS-AI/
├── .github/
│   ├── workflows/          # GitHub Actions workflows
│   ├── scripts/            # AI orchestration scripts
│   └── ISSUE_TEMPLATE/     # Issue templates
├── database/               # SQLite database
├── public/                 # Frontend files
│   ├── index.html         # Main UI
│   ├── styles.css         # Styling
│   └── app.js             # JavaScript app
├── scripts/               # Setup and utility scripts
│   ├── setup.js          # Setup wizard
│   └── init-database.js  # Database initialization
├── server/                # Backend server
│   ├── index.js          # Express server
│   ├── atlantis-ai.js    # Master AI coordinator
│   └── sub-ai-agents.js  # Sub-AI agent system
├── uploads/              # Uploaded files
├── logs/                 # Application logs
├── .env.example          # Environment template
├── package.json          # Dependencies
└── README.md            # This file
```

## 🤖 Sub-AI Specializations

| Agent | Specialization | Expertise Areas |
|-------|---------------|-----------------|
| Code Architect | Code Development | JavaScript, Python, Java, TypeScript, Go, Rust, C# |
| System Architect | Software Architecture | Microservices, Design Patterns, Event-Driven |
| Quality Assurance | Testing & QA | Unit, Integration, E2E, Performance Testing |
| Security Guardian | Security & Compliance | Vulnerability Assessment, Penetration Testing |
| Documentation Expert | Documentation | API Docs, User Guides, Technical Writing |
| DevOps Engineer | DevOps & CI/CD | Docker, Kubernetes, GitHub Actions, Terraform |
| Data Scientist | Data Science & ML | Machine Learning, Neural Networks, NLP |
| UI/UX Designer | User Interface | React, Vue, Design Systems, Accessibility |
| Backend Specialist | Backend Development | REST APIs, GraphQL, Databases, Caching |
| Frontend Specialist | Frontend Development | HTML/CSS, JavaScript, Responsive Design, PWAs |
| Database Expert | Database Design | SQL, NoSQL, Query Optimization, Data Modeling |
| API Designer | API Design | REST, GraphQL, gRPC, WebSockets, API Security |

## 🔌 API Reference

### Create Task
```http
POST /api/tasks
Content-Type: application/json

{
  "userId": "github-username",
  "title": "Task title",
  "description": "Detailed description",
  "timeline": "2 weeks",
  "desiredOutcomes": "What success looks like",
  "availableResources": "Existing code, docs, etc.",
  "priority": "normal"
}
```

### Get Task Status
```http
GET /api/tasks/:taskId
```

### Interact with ATLANTIS
```http
POST /api/tasks/:taskId/interact
Content-Type: application/json

{
  "message": "What's the status of my task?"
}
```

### Get Sub-AI Agents
```http
GET /api/agents
```

### Upload File
```http
POST /api/upload
Content-Type: multipart/form-data

file: <file>
userId: <username>
taskId: <optional-task-id>
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Prevent API abuse
- **Helmet.js**: Security headers
- **Input Validation**: Sanitize user inputs
- **File Type Restrictions**: Safe file uploads
- **HTTPS Support**: SSL/TLS encryption ready
- **CORS Protection**: Controlled cross-origin access

## 🌐 GitHub Integration

ATLANTIS-AI integrates deeply with GitHub:

- **GitHub Actions**: Automated workflows
- **GitHub Issues**: Task tracking
- **GitHub Projects**: Project management
- **GitHub Discussions**: Community collaboration
- **GitHub Wiki**: Knowledge base
- **GitHub Pages**: Documentation site
- **Dependabot**: Dependency updates
- **GitHub Copilot**: Code suggestions

## 📊 Metrics & Monitoring

Track system performance:
- Total tasks created
- Active tasks in progress
- Completed tasks
- Work bots deployed
- Sub-AI agent load
- Average completion time
- Success rate

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@atlantis-ai.dev
- 💬 Discussions: [GitHub Discussions](https://github.com/US-SPURS/ATLANTIS-AI/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/US-SPURS/ATLANTIS-AI/issues)

## 🙏 Acknowledgments

- Anthropic for Claude AI
- OpenAI for GPT-4
- GitHub for amazing DevOps tools
- The open-source community

---

**Built with 🌟 by US-SPURS**  
*Empowering the future of AI-driven development*
