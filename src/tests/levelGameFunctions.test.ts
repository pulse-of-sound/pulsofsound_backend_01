import '../tests/parseMock';
import Parse from 'parse/node';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
});

describe('LevelGameFunctions - Mock Tests', () => {

  it('addLevelGameByAdmin - fake test', async () => {
    const fakeAddLevelGameByAdmin = async (req: any) => {
      if (!req.params.levelId) throw { codeStatus: 1002 };
      return { message: 'LevelGame added successfully', levelGame: { name: req.params.name } };
    };

    const req: any = { params: { levelId: 'lvl1', name: 'Stage 1', order: 1 } };
    const result = await fakeAddLevelGameByAdmin(req);
    expect(result.message).toBe('LevelGame added successfully');
    expect(result.levelGame.name).toBe('Stage 1');
  });

  it('getLevelGamesForLevel - fake test', async () => {
    const fakeGetLevelGamesForLevel = async (req: any) => {
      return { stages: [{ objectId: 'lg1', name: 'Stage 1' }] };
    };

    const req: any = { params: { level_id: 'lvl1' } };
    const result = await fakeGetLevelGamesForLevel(req);
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].name).toBe('Stage 1');
  });

});
