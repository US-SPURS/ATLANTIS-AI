/**
 * Tests for ATLANTIS Master AI
 */

const AtlantisAI = require('../server/atlantis-ai');
const { initializeDatabase, seedSubAIAgents } = require('../scripts/init-database');

describe('ATLANTIS Master AI', () => {
  let db;
  let atlantis;
  let mockAIClients;

  beforeAll(() => {
    // Create in-memory database for testing
    db = initializeDatabase(':memory:');
    seedSubAIAgents(db);

    // Mock AI clients
    mockAIClients = {
      claude: {
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ text: JSON.stringify({ primaryIntent: 'Test task' }) }]
          })
        }
      }
    };

    atlantis = new AtlantisAI(db, mockAIClients);
  });

  afterAll(() => {
    db.close();
  });

  describe('Task Creation', () => {
    test('should create a new task', async () => {
      const taskInput = {
        userId: 1,
        title: 'Test Task',
        description: 'This is a test task',
        priority: 'normal'
      };

      const task = await atlantis.createTask(taskInput);

      expect(task).toBeDefined();
      expect(task.task_id).toMatch(/^task-/);
      expect(task.title).toBe('Test Task');
    });
  });

  describe('Task Status Retrieval', () => {
    test('should get task status', async () => {
      const task = await atlantis.createTask({
        userId: 1,
        title: 'Status Test',
        description: 'Test status retrieval'
      });

      const status = atlantis.getTaskStatus(task.task_id);

      expect(status).toBeDefined();
      expect(status.task).toBeDefined();
    });
  });
});
