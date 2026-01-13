import '../tests/parseMock';
import trainingFlowFunctions from '../cloudCode/modules/TrainingQuestion/functions';
import TrainingQuestionCorrectAnswer from '../cloudCode/models/TrainingQuestionCorrectAnswer';

const { Parse } = global as any;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

jest.mock('../cloudCode/models/TrainingQuestion', () => {
  return {
    __esModule: true,
    default: class FakeTrainingQuestion {
      id = 'q1';
      attributes: any = {};
      set(field: string, value: any) { this.attributes[field] = value; }
      get(field: string) { return this.attributes[field] || null; }
      async save() { return this; }
    },
  };
});

jest.mock('../cloudCode/models/TrainingQuestionCorrectAnswer', () => {
  return {
    __esModule: true,
    default: class FakeAnswer {
      attributes: any = {};
      get(field: string) {
        if (field === 'correct_option') return 'A';
        return this.attributes[field] || null;
      }
      set(field: string, value: any) { this.attributes[field] = value; }
      async save() { return this; }
    },
  };
});

const createUserWithSession = () => {
  const user = new Parse.User();
  user.id = 'user1';
  const session = new Parse.Session(user);
  (user as any)._session = session;
  user.getSessionToken = () => 'fake-session-token';
  return user;
};

describe('TrainingFlowFunctions', () => {
  describe('getNextTrainingQuestion', () => {

    it('should throw error if session token is missing', async () => {
      const req: any = { params: { question_id: 'q1', selected_option: 'A' }, headers: {} };
      await expect(trainingFlowFunctions.getNextTrainingQuestion(req))
        .rejects.toThrow('Session token is required');
    });

    it('should throw error if session token is invalid', async () => {
      jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(null);

      const req: any = { params: { question_id: 'q1', selected_option: 'A' }, headers: { 'x-parse-session-token': 'invalid-token' } };
      await expect(trainingFlowFunctions.getNextTrainingQuestion(req))
        .rejects.toThrow('Invalid session token');
    });

    it('should throw error if user not found in session', async () => {
      const sessionObj = { get: () => null };
      jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(sessionObj);

      const req: any = { params: { question_id: 'q1', selected_option: 'A' }, headers: { 'x-parse-session-token': 'valid-token' } };
      await expect(trainingFlowFunctions.getNextTrainingQuestion(req))
        .rejects.toThrow('User not found');
    });
  });
});
