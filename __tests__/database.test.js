/**
 * Tests for database initialization
 */

const { initializeDatabase, seedSubAIAgents } = require('../scripts/init-database');

describe('Database', () => {
  let db;

  beforeAll(() => {
    db = initializeDatabase(':memory:');
  });

  afterAll(() => {
    db.close();
  });

  test('should initialize database schema', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('sub_ai_agents');
    expect(tableNames).toContain('work_bots');
  });

  test('should seed sub-AI agents', () => {
    seedSubAIAgents(db);
    
    const agents = db.prepare('SELECT * FROM sub_ai_agents').all();
    expect(agents.length).toBe(12);
  });
});
