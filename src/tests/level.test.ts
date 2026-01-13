import '../tests/parseMock';
import levelFunctions from '../cloudCode/modules/Level/functions';

jest.mock('../cloudCode/models/Level', () => {
//محاكاة psrse.level
  class FakeLevel {
    id = 'level1';
    attributes: any = {};

    set(field: string, value: any) {
      this.attributes[field] = value;
    }

    get(field: string) {
      return this.attributes[field];
    }

    toJSON() {
      return {
        objectId: this.id,
        ...this.attributes,
      };
    }

    async save() {
      return this;
    }

    async destroy() {
      return true;
    }
  }

  return {
    __esModule: true,
    default: FakeLevel,
  };
});

const GlobalParse: any = (global as any).Parse;
//إخفاء رسائل الكونسول
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LevelFunctions', () => {
  // addLevelByAdmin
//حالة اضافة مستوى بنفس رقم المستوى السابق
  describe('addLevelByAdmin', () => {
    it('should throw error if level with same order exists', async () => {
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async () => {
          return {id: 'existingLevel'};
        });

      const req: any = {
        params: {
          name: 'Level 1',
          description: 'Desc',
          order: 1,
        },
      };

      await expect(levelFunctions.addLevelByAdmin(req)).rejects.toMatchObject({
        codeStatus: 101,
        message: 'Level with this order already exists',
      });
    });
//إنشاء مستوى جديد
    it('should create level successfully when order is unique', async () => {
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async () => null);

      const req: any = {
        params: {
          name: 'Level 1',
          description: 'Desc',
          order: 1,
        },
      };

      const result = await levelFunctions.addLevelByAdmin(req);

      expect(result).toHaveProperty('message', 'Level added successfully');
      expect(result.level).toHaveProperty('name', 'Level 1');
      expect(result.level).toHaveProperty('order', 1);
    });
  });
  // getAllLevels
//جلب كل المستويات
  describe('getAllLevels', () => {
    it('should return all levels sorted by order', async () => {
      const fakeLevel1: any = {
        id: 'l1',
        get: (field: string) => {
          const data = {name: 'A', description: 'D1', order: 1};
          return (data as any)[field];
        },
      };

      const fakeLevel2: any = {
        id: 'l2',
        get: (field: string) => {
          const data = {name: 'B', description: 'D2', order: 2};
          return (data as any)[field];
        },
      };

      jest
        .spyOn(GlobalParse.Query.prototype, 'find')
        .mockImplementationOnce(async () => [fakeLevel1, fakeLevel2]);

      const req: any = {params: {}};
      const result = await levelFunctions.getAllLevels(req);

      expect(result).toHaveProperty(
        'message',
        'All levels fetched successfully'
      );
      expect(result.levels.length).toBe(2);

      expect(result.levels[0]).toMatchObject({
        objectId: 'l1',
        name: 'A',
        order: 1,
      });
    });
  });
  // getLevelById
//المستوى غير موجود
  describe('getLevelById', () => {
    it('should throw error if level not found', async () => {
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async () => null);

      const req: any = {params: {level_id: 'missing'}};

      await expect(levelFunctions.getLevelById(req)).rejects.toMatchObject({
        codeStatus: 404,
        message: 'Level not found',
      });
    });

    it('should return level when found', async () => {
      const fakeLevel: any = {
        id: 'l1',
        toJSON: () => ({objectId: 'l1', name: 'Level 1', order: 1}),
      };

      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async () => fakeLevel);

      const req: any = {params: {level_id: 'l1'}};

      const result = await levelFunctions.getLevelById(req);

      expect(result).toHaveProperty('message', 'Level fetched successfully');
      expect(result.level).toHaveProperty('objectId', 'l1');
    });
  });
//المستوى غير موجود
  describe('deleteLevel', () => {
    it('should throw error if level not found', async () => {
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async () => null);

      const req: any = {params: {level_id: 'missing'}};

      await expect(levelFunctions.deleteLevel(req)).rejects.toMatchObject({
        codeStatus: 404,
        message: 'Level not found',
      });
    });
//المستوى موجود
    it('should delete level successfully', async () => {
      const fakeLevel: any = {
        id: 'l1',
        destroy: async () => true,
      };

      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async () => fakeLevel);

      const req: any = {params: {level_id: 'l1'}};

      const result = await levelFunctions.deleteLevel(req);

      expect(result).toHaveProperty('message', 'Level deleted successfully');
      expect(result).toHaveProperty('deleted_id', 'l1');
    });
  });
});
