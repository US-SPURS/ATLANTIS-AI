#!/usr/bin/env node
/**
 * ATLANTIS-AI Setup Script
 * Automated setup wizard for first-time installation
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n');
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log('🌟 ATLANTIS-AI Setup Wizard');
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log('\n');

  console.log('Welcome to ATLANTIS-AI! This wizard will help you set up the system.\n');

  // Check if .env exists
  const envPath = path.join(__dirname, '../.env');
  const envExamplePath = path.join(__dirname, '../.env.example');

  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env file already exists. Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Skipping .env configuration...');
      rl.close();
      return;
    }
  }

  console.log('\n📋 Configuration Setup\n');

  // Get configuration values
  const githubToken = await question('GitHub Token (optional for now): ');
  const anthropicKey = await question('Anthropic API Key (for Claude AI, optional): ');
  const openaiKey = await question('OpenAI API Key (for ChatGPT, optional): ');
  const port = await question('Server Port (default 3000): ') || '3000';

  // Create .env file
  const envContent = fs.readFileSync(envExamplePath, 'utf8')
    .replace('your_github_token_here', githubToken || 'your_github_token_here')
    .replace('your_anthropic_api_key_here', anthropicKey || 'your_anthropic_api_key_here')
    .replace('your_openai_api_key_here', openaiKey || 'your_openai_api_key_here')
    .replace('PORT=3000', `PORT=${port}`)
    .replace('your_jwt_secret_here_min_32_chars', generateSecret(32))
    .replace('your_session_secret_here_min_32_chars', generateSecret(32))
    .replace('your_encryption_key_here_32_chars', generateSecret(32))
    .replace('your_webhook_secret_here', generateSecret(16));

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env file created');

  // Create necessary directories
  console.log('\n📁 Creating directories...');
  const dirs = ['database', 'uploads', 'logs', 'public', 'server'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`  ✓ Created ${dir}/`);
    }
  });

  // Initialize database
  console.log('\n🗄️  Initializing database...');
  try {
    const { initializeDatabase, seedSubAIAgents } = require('./init-database');
    const db = initializeDatabase(path.join(__dirname, '../database/atlantis.db'));
    seedSubAIAgents(db);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }

  // Install dependencies if needed
  const installDeps = await question('\nInstall npm dependencies? (y/n): ');
  if (installDeps.toLowerCase() === 'y') {
    console.log('\n📦 Installing dependencies...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed');
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
    }
  }

  console.log('\n');
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log('🌟 Setup Complete!');
  console.log('🌟 ═══════════════════════════════════════════════════════════');
  console.log('\n');
  console.log('Next steps:');
  console.log('1. Review and update .env file with your API keys');
  console.log('2. Run: npm start');
  console.log(`3. Open: http://localhost:${port}`);
  console.log('\n');

  rl.close();
}

function generateSecret(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Run setup
setup().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
