# ATLANTIS-AI API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API uses simple user identification via GitHub usernames. Future versions will implement JWT-based authentication.

## Endpoints

### Health Check

Check system health and status.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "atlantis": "online",
  "subAIs": 12,
  "aiClients": {
    "claude": true,
    "openai": true
  }
}
```

---

### Create Task

Submit a new task to ATLANTIS for processing.

**Endpoint:** `POST /api/tasks`

**Request Body:**
```json
{
  "userId": "github-username",
  "title": "Build Authentication System",
  "description": "Create a complete authentication system with JWT...",
  "timeline": "2 weeks",
  "desiredOutcomes": "Secure, scalable auth system",
  "availableResources": "Existing user database, API framework",
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "task-abc123",
  "understanding": {
    "primaryIntent": "Build authentication system",
    "complexity": "Moderate"
  },
  "projectPlan": {
    "overview": "...",
    "workPackages": [...]
  },
  "assignments": [
    {
      "assignmentId": "assign-xyz",
      "agentName": "Security Guardian",
      "workPackage": "Authentication logic"
    }
  ],
  "message": "Task received and processing initiated"
}
```

---

### Get Task Status

Retrieve current status and progress of a task.

**Endpoint:** `GET /api/tasks/:taskId`

**Parameters:**
- `taskId` (string): Task identifier

**Response:**
```json
{
  "task": {
    "id": 1,
    "task_id": "task-abc123",
    "title": "Build Authentication System",
    "status": "in-progress",
    "priority": "high",
    "created_at": "2025-10-25T08:00:00Z"
  },
  "assignments": [
    {
      "assignment_id": "assign-xyz",
      "agent_name": "Security Guardian",
      "status": "in-progress",
      "progress": 45
    }
  ],
  "updates": [
    {
      "update_id": "update-123",
      "source_type": "sub-ai",
      "message": "Completed authentication logic implementation",
      "created_at": "2025-10-25T09:30:00Z"
    }
  ]
}
```

---

### Get User Tasks

Retrieve all tasks for a specific user.

**Endpoint:** `GET /api/users/:userId/tasks`

**Parameters:**
- `userId` (string): GitHub username

**Response:**
```json
[
  {
    "id": 1,
    "task_id": "task-abc123",
    "title": "Build Authentication System",
    "status": "in-progress",
    "priority": "high",
    "created_at": "2025-10-25T08:00:00Z"
  },
  {
    "id": 2,
    "task_id": "task-def456",
    "title": "Create API Documentation",
    "status": "completed",
    "priority": "normal",
    "created_at": "2025-10-24T10:00:00Z"
  }
]
```

---

### Interact with ATLANTIS

Send a message to ATLANTIS about a specific task.

**Endpoint:** `POST /api/tasks/:taskId/interact`

**Request Body:**
```json
{
  "message": "What's the current status of this task?"
}
```

**Response:**
```json
{
  "response": "Your task is progressing well. The Security Guardian has completed the authentication logic and is now working on password hashing. The Code Architect is implementing the API endpoints. Estimated completion: 3 days."
}
```

---

### Get Sub-AI Agents

Retrieve status of all sub-AI agents.

**Endpoint:** `GET /api/agents`

**Response:**
```json
[
  {
    "agent_id": "sub-ai-code",
    "name": "Code Architect",
    "specialization": "Code Development",
    "current_load": 3,
    "max_capacity": 10,
    "performance_score": 98.5
  },
  {
    "agent_id": "sub-ai-security",
    "name": "Security Guardian",
    "specialization": "Security & Compliance",
    "current_load": 2,
    "max_capacity": 10,
    "performance_score": 99.2
  }
]
```

---

### Get Progress Updates

Retrieve progress updates for a specific task.

**Endpoint:** `GET /api/tasks/:taskId/progress`

**Response:**
```json
[
  {
    "update_id": "update-123",
    "source_type": "atlantis",
    "source_id": "ATLANTIS",
    "message": "Task received and analyzed",
    "progress_percentage": 10,
    "created_at": "2025-10-25T08:00:00Z"
  },
  {
    "update_id": "update-124",
    "source_type": "sub-ai",
    "source_id": "sub-ai-security",
    "message": "Started authentication implementation",
    "progress_percentage": 25,
    "created_at": "2025-10-25T08:15:00Z"
  }
]
```

---

### Upload File

Upload context files for task understanding.

**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (file): File to upload
- `userId` (string): GitHub username
- `taskId` (string, optional): Task ID to associate file with

**Response:**
```json
{
  "success": true,
  "fileId": "file-1698234567",
  "filename": "requirements.pdf",
  "size": 102400
}
```

---

### Get System Metrics

Retrieve overall system performance metrics.

**Endpoint:** `GET /api/metrics`

**Response:**
```json
{
  "tasks": {
    "total": 45,
    "completed": 32,
    "active": 13
  },
  "workBots": 156,
  "agentLoad": 18
}
```

---

## WebSocket API

Connect to real-time updates via WebSocket.

**URL:** `ws://localhost:3000/ws`

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to ATLANTIS');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Subscribe to Task Updates

```javascript
ws.send(JSON.stringify({
  type: 'subscribe-task',
  taskId: 'task-abc123'
}));
```

### Message Types

**Connected:**
```json
{
  "type": "connected",
  "message": "Connected to ATLANTIS-AI WebSocket"
}
```

**Task Created:**
```json
{
  "type": "task-created",
  "data": {
    "taskId": "task-abc123",
    "title": "..."
  }
}
```

**Progress Update:**
```json
{
  "type": "progress-update",
  "taskId": "task-abc123",
  "message": "Work bot completed sub-task",
  "progress": 45
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Window:** 15 minutes
- **Max Requests:** 100 per window

Exceeding the rate limit returns `429 Too Many Requests`.

---

## Examples

### cURL Examples

**Create Task:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "johndoe",
    "title": "Build API",
    "description": "REST API with authentication",
    "priority": "high"
  }'
```

**Get Task Status:**
```bash
curl http://localhost:3000/api/tasks/task-abc123
```

**Upload File:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@requirements.pdf" \
  -F "userId=johndoe"
```

### JavaScript Examples

**Create Task:**
```javascript
const response = await fetch('http://localhost:3000/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'johndoe',
    title: 'Build API',
    description: 'REST API with authentication',
    priority: 'high'
  })
});

const result = await response.json();
console.log('Task created:', result.taskId);
```

**WebSocket Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'progress-update') {
    console.log('Progress:', data.message);
  }
};
```

---

## SDK (Coming Soon)

Official SDKs will be available for:
- JavaScript/TypeScript
- Python
- Go
- Ruby

---

For more information, visit [https://us-spurs.github.io/ATLANTIS-AI](https://us-spurs.github.io/ATLANTIS-AI)
