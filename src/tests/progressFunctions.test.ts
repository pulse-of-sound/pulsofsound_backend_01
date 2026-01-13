import ProgressFunctions from '../cloudCode/modules/Progress/functions';
import '../tests/parseMock';
import http from 'http';

jest.mock('http');

const { getChildProgress } = ProgressFunctions as any;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
});

describe('ProgressFunctions', () => {

  it('should throw error if user_id is missing', async () => {
    const req: any = { params: {} };
    await expect(getChildProgress(req)).rejects.toMatchObject({ codeStatus: 103 });
  });

  it('should use child_id if provided', async () => {
    const req: any = { params: { user_id: 'u1', child_id: 'c1' } };

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = {
        on: (event: string, handler: Function) => {
          if (event === 'data') handler(JSON.stringify({ results: [] }));
          if (event === 'end') handler();
        }
      };
      callback(res);
      return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(result.success).toBe(true);
    expect(result.stats.total_games_played).toBe(0);
  });

  it('should use user_id if child_id not provided', async () => {
    const req: any = { params: { user_id: 'u1' } };

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = {
        on: (event: string, handler: Function) => {
          if (event === 'data') handler(JSON.stringify({ results: [] }));
          if (event === 'end') handler();
        }
      };
      callback(res);
      return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(result.success).toBe(true);
    expect(result.stats.total_games_played).toBe(0);
  });

  it('should calculate stats even if results empty', async () => {
    const req: any = { params: { user_id: 'u1' } };
    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = { on: (_e: string, h: any) => { if (_e === 'data') h(JSON.stringify({ results: [] })); if (_e === 'end') h(); } };
      callback(res); return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(result.stats.total_score).toBe(0);
    expect(result.stats.average_score).toBe(0);
  });

  it('should return recent_results as array', async () => {
    const req: any = { params: { user_id: 'u1' } };

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = { on: (_e: string, h: any) => { if (_e === 'data') h(JSON.stringify({ results: [] })); if (_e === 'end') h(); } };
      callback(res); return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(Array.isArray(result.stats.recent_results)).toBe(true);
  });

  it('should handle multiple results correctly', async () => {
    const req: any = { params: { user_id: 'u1' } };

    const results = [
      { objectId: 'r1', score: 5, total_questions: 10, level_game_id: { level_id: { objectId: 'l1', title: 'Level 1' }, title: 'Game 1' }, createdAt: '2026-01-13' },
      { objectId: 'r2', score: 8, total_questions: 10, level_game_id: { level_id: { objectId: 'l1', title: 'Level 1' }, title: 'Game 1' }, createdAt: '2026-01-14' }
    ];

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = { on: (_e: string, h: any) => { if (_e === 'data') h(JSON.stringify({ results })); if (_e === 'end') h(); } };
      callback(res); return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(result.stats.total_games_played).toBe(2);
    expect(result.stats.total_score).toBe(13);
    expect(result.stats.levels_progress['l1'].games_played).toBe(2);
  });

  it('should handle HTTP parsing errors gracefully', async () => {
    const req: any = { params: { user_id: 'u1' } };

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = { on: (_e: string, h: any) => { if (_e === 'data') h('INVALID JSON'); if (_e === 'end') h(); } };
      callback(res); return { on: jest.fn() };
    });

    await expect(getChildProgress(req)).rejects.toMatchObject({ codeStatus: 1030 });
  });

  it('should fallback to user_id if child_id null', async () => {
    const req: any = { params: { user_id: 'user123', child_id: null } };

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = { on: (_e: string, h: any) => { if (_e === 'data') h(JSON.stringify({ results: [] })); if (_e === 'end') h(); } };
      callback(res); return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(result.stats.total_games_played).toBe(0);
  });

  it('should limit recent_results to 10', async () => {
    const req: any = { params: { user_id: 'u1' } };

    const results = Array.from({ length: 15 }).map((_, i) => ({
      objectId: `r${i+1}`,
      score: 1,
      total_questions: 2,
      level_game_id: { level_id: { objectId: `l1`, title: 'Level 1' }, title: 'Game 1' },
      createdAt: `2026-01-${i+1}`
    }));

    (http.get as any).mockImplementation((_url: string, _options: any, callback: any) => {
      const res = { on: (_e: string, h: any) => { if (_e === 'data') h(JSON.stringify({ results })); if (_e === 'end') h(); } };
      callback(res); return { on: jest.fn() };
    });

    const result = await getChildProgress(req);
    expect(result.stats.recent_results.length).toBe(10);
  });

});
