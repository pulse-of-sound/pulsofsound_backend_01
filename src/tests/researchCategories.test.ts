import '../tests/parseMock';
import researchFunctions from '../cloudCode/modules/ResearchCategories/functions';
import ResearchCategories from '../cloudCode/models/ResearchCategories';

const { Parse } = global as any;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const createUser = (roleName: string | null = 'Admin') => {
  const user = new Parse.User();
  user.get = (field: string) => {
    if (field === 'role') {
      return {
        fetch: async () => ({ get: (f: string) => (f === 'name' ? roleName : null) }),
      };
    }
    return null;
  };
  return user;
};

jest.mock('../cloudCode/models/ResearchCategories', () => {
  class FakeCategory {
    id = 'cat1';
    attributes: any = {};
    set(field: string, value: any) {
      this.attributes[field] = value;
    }
    get(field: string) {
      return this.attributes[field];
    }
    async save(_data?: any, _options?: any) {
      return this;
    }
  }
  return {
    __esModule: true,
    default: FakeCategory,
  };
});

describe('ResearchCategoriesFunctions', () => {
  describe('createResearchCategory', () => {
    it('should throw error if user is not logged in', async () => {
      const req: any = { params: { name: 'Test Category' }, headers: {} };
      await expect(researchFunctions.createResearchCategory(req)).rejects.toMatchObject({
        code: 141,
        message: 'User is not logged in',
      });
    });

    it('should throw error if user is not admin', async () => {
      const user = createUser('Doctor');
      const sessionObj = { get: (field: string) => (field === 'user' ? user : null) };
      jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValue(sessionObj);

      const req: any = {
        params: { name: 'Test Category' },
        headers: { 'x-parse-session-token': 'valid-token' },
      };

      await expect(researchFunctions.createResearchCategory(req)).rejects.toMatchObject({
        code: 403,
        message: 'Only admins can add categories',
      });
    });

    it('should create category successfully for admin', async () => {
      const user = createUser('Admin');
      const sessionObj = { get: (field: string) => (field === 'user' ? user : null) };
      jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValue(sessionObj);

      const req: any = {
        params: { name: 'Test Category' },
        headers: { 'x-parse-session-token': 'valid-token' },
      };

      const result = await researchFunctions.createResearchCategory(req);
      expect(result).toHaveProperty('message', 'The category was created successfully.');
      expect(result).toHaveProperty('category_id', 'cat1');
    });
  });

  describe('getAllResearchCategories', () => {
    it('should return formatted list of categories', async () => {
      const fakeCat1 = { id: 'cat1', get: (field: string) => ({ name: 'Cat A', created_at: new Date(), updated_at: new Date() }[field]) };
      const fakeCat2 = { id: 'cat2', get: (field: string) => ({ name: 'Cat B', created_at: new Date(), updated_at: new Date() }[field]) };

      jest.spyOn(Parse.Query.prototype, 'find').mockResolvedValue([fakeCat1, fakeCat2]);

      const req: any = { params: {} };
      const result = await researchFunctions.getAllResearchCategories(req);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toMatchObject({ category_id: 'cat1', name: 'Cat A' });
      expect(result[1]).toMatchObject({ category_id: 'cat2', name: 'Cat B' });
    });
  });
});
