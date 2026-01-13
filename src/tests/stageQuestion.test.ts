import stageQuestionFunctions from '../cloudCode/modules/StageQuestion/functions';
import '../tests/parseMock';

const { Parse } = global as any;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
jest.mock('../cloudCode/models/LevelGame', () => {
  return {
    __esModule: true,
    default: class FakeLevelGame {
      id = 'level1';
    },
  };
});
jest.mock('../cloudCode/models/StageQuestion', () => {
  return {
    __esModule: true,
    default: class FakeStageQuestion {
      id = 'q1';
      attributes: any = {};

      set(key: string, value: any) {
        this.attributes[key] = value;
      }
      get(key: string) {
        return this.attributes[key];
      }
      async save() {
        return this;
      }
      async destroy() {
        return;
      }
      toJSON() {
        return this.attributes;
      }
    },
  };
});

describe('StageQuestion functions', () => {
  it('should throw error when LevelGame is not found', async () => {
    jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(null);

    const req: any = {
      params: {
        level_game_id: 'invalid-id',
        questions: [],
      },
    };

    await expect(
      stageQuestionFunctions.addQuestionsToStage(req),
    ).rejects.toMatchObject({
      codeStatus: 404,
    });
  });

  it('should add questions successfully', async () => {
    const fakeLevelGame = { id: 'level1' };

    jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(fakeLevelGame);

    const req: any = {
      params: {
        level_game_id: 'level1',
        questions: [
          {
            question_type: 'MCQ',
            instruction: 'Choose correct answer',
            options: ['A', 'B'],
            correct_answer: 'A',
          },
        ],
      },
    };

    const result = await stageQuestionFunctions.addQuestionsToStage(req);

    expect(result).toMatchObject({
      message: 'Questions added successfully',
      count: 1,
    });
    expect(result.questions.length).toBe(1);
  });
  it('should return zero deleted when no questions found', async () => {
    jest.spyOn(Parse.Query.prototype, 'find').mockResolvedValueOnce([]);

    const req: any = {
      params: {
        question_ids: ['q1', 'q2'],
      },
    };

    const result = await stageQuestionFunctions.deleteStageQuestionsByIds(req);

    expect(result).toEqual({
      message: 'No matching questions found',
      deleted_count: 0,
    });
  });
  it('should fetch stage questions successfully', async () => {
    const fakeQuestion = {
      id: 'q1',
      get: (field: string) => {
        const map: any = {
          question_type: 'MCQ',
          instruction: 'Test',
          images: null,
          options: ['A', 'B'],
          correct_answer: 'A',
        };
        return map[field];
      },
    };

    jest.spyOn(Parse.Query.prototype, 'find').mockResolvedValueOnce([fakeQuestion]);

    const req: any = {
      params: {
        level_game_id: 'level1',
      },
      user: undefined,
    };

    const result = await stageQuestionFunctions.getStageQuestions(req);

    expect(result).toMatchObject({
      message: 'Stage questions fetched successfully',
      count: 1,
    });
    expect(result.questions[0].objectId).toBe('q1');
  });
  describe('StageQuestion functions – deeper tests', () => {

  it('should delete multiple questions successfully', async () => {
    const destroyMock = jest.fn();

    jest.spyOn(Parse.Query.prototype, 'find').mockResolvedValue([
      { destroy: destroyMock },
      { destroy: destroyMock },
    ]);

    const req: any = {
      params: {
        question_ids: ['q1', 'q2'],
      },
    };

    const result = await stageQuestionFunctions.deleteStageQuestionsByIds(req);

    expect(destroyMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      deleted_count: 2,
      deleted_ids: ['q1', 'q2'],
    });
  });

  it('should return stage questions ordered by order field', async () => {
    const fakeQuestions = [
      {
        id: 'q1',
        get: (key: string) =>
          ({
            question_type: 'type1',
            instruction: 'inst1',
            images: [],
            options: [],
            correct_answer: 'a',
          } as any)[key],
      },
      {
        id: 'q2',
        get: (key: string) =>
          ({
            question_type: 'type2',
            instruction: 'inst2',
            images: [],
            options: [],
            correct_answer: 'b',
          } as any)[key],
      },
    ];

    jest.spyOn(Parse.Query.prototype, 'find').mockResolvedValue(fakeQuestions);

    const req: any = {
      params: {
        level_game_id: 'stage1',
      },
      user: undefined,
    };

    const result = await stageQuestionFunctions.getStageQuestions(req);

    expect(result.count).toBe(2);
    expect(result.questions[0].objectId).toBe('q1');
    expect(result.questions[1].objectId).toBe('q2');
  });
});

});
