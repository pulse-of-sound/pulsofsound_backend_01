import ChildProfile_ from '../cloudCode/modules/ChildProfile/functions';
import '../tests/parseMock';

const {Parse} = global as any;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

jest.mock('../cloudCode/models/ChildProfile', () => {
  return {
    __esModule: true,
    default: class FakeChildProfile {
      id = 'child1';
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
      toJSON() {
        return this.attributes;
      }
    },
  };
});

describe('ChildProfile functions', () => {
  const instance = new ChildProfile_();

  describe('getMyChildProfile', () => {
    it('should throw error when user context is missing', async () => {
      const req: any = {
        params: {},
        user: undefined,
        headers: {},
      };

      await expect(instance.getMyChildProfile(req)).rejects.toMatchObject({
        codeStatus: 103,
      });
    });
  });

  describe('createOrUpdateChildProfile', () => {
    it('should throw error when user is not found', async () => {
      jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(null);

      const req: any = {
        params: {
          childId: 'non-existing-user',
        },
      };

      await expect(
        instance.createOrUpdateChildProfile(req)
      ).rejects.toMatchObject({
        codeStatus: 101,
      });
    });
  });
  it('should throw error when user role is not Child', async () => {
    const fakeUser = {
      get: (field: string) => {
        if (field === 'role') {
          return {
            get: (nameField: string) =>
              nameField === 'name' ? 'Parent' : null,
          };
        }
        return null;
      },
    };

    jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(fakeUser);

    const req: any = {
      params: {
        childId: 'user-with-wrong-role',
      },
    };

    await expect(
      instance.createOrUpdateChildProfile(req)
    ).rejects.toMatchObject({
      codeStatus: 102,
    });
  });
});
