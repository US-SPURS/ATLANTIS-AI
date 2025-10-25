#!/usr/bin/env node
/**
 * Production Deployment Script
 * Prepares the application for production deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 ATLANTIS-AI Deployment Script\n');

async function deploy() {
  try {
    // Step 1: Check environment
    console.log('1️⃣  Checking environment...');
    if (!process.env.NODE_ENV) {
      console.warn('⚠️  NODE_ENV not set, setting to production');
      process.env.NODE_ENV = 'production';
    }

    // Step 2: Install production dependencies
    console.log('\n2️⃣  Installing production dependencies...');
    execSync('npm ci --production', { stdio: 'inherit' });

    // Step 3: Build frontend assets
    console.log('\n3️⃣  Building frontend assets...');
    execSync('npm run build', { stdio: 'inherit' });

    // Step 4: Initialize database
    console.log('\n4️⃣  Initializing database...');
    execSync('npm run db:init', { stdio: 'inherit' });

    // Step 5: Run security audit
    console.log('\n5️⃣  Running security audit...');
    try {
      execSync('npm audit --production', { stdio: 'inherit' });
    } catch (error) {
      console.warn('⚠️  Security audit found issues. Review and fix before deploying.');
    }

    // Step 6: Verify configuration
    console.log('\n6️⃣  Verifying configuration...');
    const envPath = path.join(__dirname, '../.env');
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found! Create one from .env.example');
      process.exit(1);
    }

    // Step 7: Create necessary directories
    console.log('\n7️⃣  Creating directories...');
    const dirs = ['database', 'uploads', 'logs', 'dist'];
    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✓ Created ${dir}/`);
      }
    });

    // Step 8: Set permissions (Unix-like systems)
    if (process.platform !== 'win32') {
      console.log('\n8️⃣  Setting permissions...');
      execSync('chmod +x scripts/*.js', { stdio: 'inherit' });
    }

    console.log('\n✅ Deployment preparation complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review .env configuration');
    console.log('   2. Set up reverse proxy (nginx/Apache)');
    console.log('   3. Configure SSL/TLS certificates');
    console.log('   4. Set up process manager (PM2/systemd)');
    console.log('   5. Start the server: npm start');
    console.log('\n🌟 ATLANTIS-AI is ready for production!\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy();
