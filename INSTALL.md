# ATLANTIS-AI Installation Guide

## Prerequisites

Before installing ATLANTIS-AI, ensure you have:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** (for cloning the repository)
- **API Keys** (recommended):
  - Anthropic API Key for Claude AI
  - OpenAI API Key for GPT-4

## Installation Methods

### Method 1: Quick Setup (Recommended)

```bash
# Clone repository
git clone https://github.com/US-SPURS/ATLANTIS-AI.git
cd ATLANTIS-AI

# Run setup wizard
npm install
npm run setup

# Start the server
npm start
```

### Method 2: Manual Setup

```bash
# Clone repository
git clone https://github.com/US-SPURS/ATLANTIS-AI.git
cd ATLANTIS-AI

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor

# Initialize database
npm run db:init

# Start the server
npm start
```

### Method 3: Docker (Coming Soon)

```bash
docker pull atlantis-ai:latest
docker run -p 3000:3000 atlantis-ai
```

## Configuration

### Environment Variables

Edit `.env` file with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# AI API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# GitHub Integration
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Security
JWT_SECRET=your-jwt-secret-min-32-characters
SESSION_SECRET=your-session-secret-min-32-characters
```

### API Keys Setup

#### Anthropic Claude AI
1. Visit https://console.anthropic.com/
2. Create an account
3. Generate API key
4. Add to `.env` as `ANTHROPIC_API_KEY`

#### OpenAI GPT-4
1. Visit https://platform.openai.com/
2. Create an account
3. Generate API key
4. Add to `.env` as `OPENAI_API_KEY`

#### GitHub Token (Optional)
1. Visit https://github.com/settings/tokens
2. Generate new token with required scopes
3. Add to `.env` as `GITHUB_TOKEN`

## Database Setup

ATLANTIS-AI uses SQLite by default for ease of setup:

```bash
npm run db:init
```

This creates the database with all required tables and seeds the 12 sub-AI agents.

### Upgrading to PostgreSQL (Optional)

For production deployments with higher load:

1. Install PostgreSQL
2. Create database: `createdb atlantis`
3. Update connection string in `.env`
4. Migrate schema (migration script coming soon)

## First Run

After installation:

```bash
npm start
```

Open your browser to:
- **Application**: http://localhost:3000
- **API Docs**: http://localhost:3000/api

## Verification

### Check System Health

```bash
curl http://localhost:3000/api/health
```

Expected response:
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

### Test Task Creation

1. Open http://localhost:3000
2. Enter your GitHub username
3. Navigate to "Create Task"
4. Fill in task details
5. Submit to ATLANTIS

## Troubleshooting

### Port Already in Use

Change port in `.env`:
```env
PORT=3001
```

### Database Errors

Reinitialize database:
```bash
rm database/atlantis.db
npm run db:init
```

### Missing Dependencies

```bash
rm -rf node_modules package-lock.json
npm install
```

### AI API Errors

- Verify API keys are correct
- Check API key permissions
- Ensure you have API credits

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server/index.js --name atlantis-ai

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### Using Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name atlantis-ai.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### SSL/TLS with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d atlantis-ai.yourdomain.com
```

## Updates

To update ATLANTIS-AI:

```bash
git pull origin main
npm install
npm run db:migrate  # If schema changes
npm start
```

## Backup

### Database Backup

```bash
cp database/atlantis.db database/atlantis.db.backup
```

### Full Backup

```bash
tar -czf atlantis-backup-$(date +%Y%m%d).tar.gz \
  database/ uploads/ .env
```

## Support

- Documentation: https://us-spurs.github.io/ATLANTIS-AI
- Issues: https://github.com/US-SPURS/ATLANTIS-AI/issues
- Discussions: https://github.com/US-SPURS/ATLANTIS-AI/discussions

---

**Ready to go!** 🚀 Start creating amazing AI-powered projects with ATLANTIS!
