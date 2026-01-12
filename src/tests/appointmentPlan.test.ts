import '../tests/parseMock';
import appointmentPlanFunctions from '../cloudCode/modules/AppointmentPlan/functions';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

jest.mock('../cloudCode/models/AppointmentPlan', () => {
  class FakeAppointmentPlan {
    id = 'plan1';
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

    async save(_data?: any, _options?: any) {
      return this;
    }
  }

  return {
    __esModule: true,
    default: FakeAppointmentPlan,
  };
});

const GlobalParse: any = (global as any).Parse;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AppointmentPlanFunctions', () => {
  // createAppointmentPlan
//عدم وجود Session Token
  describe('createAppointmentPlan', () => {
    it('should throw error if session token is missing', async () => {
      const req: any = {
        params: {
          title: 'Plan A',
          duration_minutes: 30,
          price: 100,
          description: 'Test plan',
        },
        headers: {},//فارغ
      };
//: Session Token غير صالح
      await expect(
        appointmentPlanFunctions.createAppointmentPlan(req)
      ).rejects.toMatchObject({
        codeStatus: 101,
        message: 'Session token is required',
      });
    });

    it('should throw error if session token is invalid', async () => {
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async function () {
          return null;
        });

      const req: any = {
        params: {
          title: 'Plan A',
          duration_minutes: 30,
          price: 100,
        },
        headers: {
          'x-parse-session-token': 'invalid-token',
        },
      };

      await expect(
        appointmentPlanFunctions.createAppointmentPlan(req)
      ).rejects.toMatchObject({
        codeStatus: 101,
        message: 'Invalid session token',
      });
    });

    it('should throw error if user is not admin', async () => {
      const user = new GlobalParse.User();
//المستخدم ليس Admin
      (user as any).get = (field: string) => {
        if (field === 'role') {
          return { id: 'role1' };
        }
        return null;
      };

      const sessionObj = {
        get: (field: string) => (field === 'user' ? user : null),
      };

      const roleObj = {
        get: (field: string) => (field === 'name' ? 'Doctor' : null),
      };

      const firstSpy = jest.spyOn(GlobalParse.Query.prototype, 'first');
      firstSpy.mockImplementationOnce(async function () {
        return sessionObj;
      });
      firstSpy.mockImplementationOnce(async function () {
        return roleObj;
      });

      const req: any = {
        params: {
          title: 'Plan A',
          duration_minutes: 30,
          price: 100,
        },
        headers: {
          'x-parse-session-token': 'some-token',
        },
      };

      await expect(
        appointmentPlanFunctions.createAppointmentPlan(req)
      ).rejects.toMatchObject({
        codeStatus: 102,
        message: 'User is not authorized to create plans',
      });
    });

    it('should create appointment plan successfully for admin user', async () => {
      const user = new GlobalParse.User();

      (user as any).get = (field: string) => {
        if (field === 'role') {
          return { id: 'role1' };
        }
        return null;
      };

      const sessionObj = {
        get: (field: string) => (field === 'user' ? user : null),
      };

      const roleObj = {
        get: (field: string) => (field === 'name' ? 'Admin' : null),
      };

      const firstSpy = jest.spyOn(GlobalParse.Query.prototype, 'first');
//Session صحيح
      firstSpy.mockImplementationOnce(async function () {
        return sessionObj;
      });
//Role = Admin
      firstSpy.mockImplementationOnce(async function () {
        return roleObj;
      });

      const req: any = {
        params: {
          title: 'Plan A',
          duration_minutes: 30,
          price: 100,
          description: 'Test plan',
        },
        headers: {
          'x-parse-session-token': 'valid-token',
        },
      };

      const result = await appointmentPlanFunctions.createAppointmentPlan(req);
//حفظ الخطة بنجاح
      expect(result).toHaveProperty(
        'message',
        'Appointment plan created successfully'
      );
      expect(result).toHaveProperty('appointmentPlan');
      expect(result.appointmentPlan).toHaveProperty('title', 'Plan A');
      expect(result.appointmentPlan).toHaveProperty(
        'duration_minutes',
        30
      );
      expect(result.appointmentPlan).toHaveProperty('price', 100);
    });
  });
  // getAvailableAppointmentPlans
//Session Token مفقود
  describe('getAvailableAppointmentPlans', () => {
    it('should throw error if session token is missing', async () => {
      const req: any = {
        params: {},
        headers: {},
      };

      await expect(
        appointmentPlanFunctions.getAvailableAppointmentPlans(req)
      ).rejects.toMatchObject({
        codeStatus: 101,
        message: 'Session token is required',
      });
    });
//Session Token غير صالح
    it('should throw error if session token is invalid', async () => {
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async function () {
          return null;
        });

      const req: any = {
        params: {},
        headers: {
          'x-parse-session-token': 'invalid-token',
        },
      };

      await expect(
        appointmentPlanFunctions.getAvailableAppointmentPlans(req)
      ).rejects.toMatchObject({
        codeStatus: 101,
        message: 'Invalid session token',
      });
    });
//مستخدم صحيح مع خطط موجودة
    it('should return list of formatted appointment plans for valid user', async () => {
      const user = new GlobalParse.User();
      (user as any).get = (field: string) => {
        if (field === 'role') {
          return { id: 'role1' };
        }
        return null;
      };

      const sessionObj = {
        get: (field: string) => (field === 'user' ? user : null),
      };

//استعلام Session
      jest
        .spyOn(GlobalParse.Query.prototype, 'first')
        .mockImplementationOnce(async function () {
          return sessionObj;
        });

// استعلام AppointmentPlan.find()
      const fakePlan1: any = {
        id: 'plan1',
        get: (field: string) => {
          const data: any = {
            title: 'Plan A',
            duration_minutes: 30,
            price: 100,
            description: 'Desc A',
          };
          return data[field];
        },
      };

      const fakePlan2: any = {
        id: 'plan2',
        get: (field: string) => {
          const data: any = {
            title: 'Plan B',
            duration_minutes: 60,
            price: 200,
            description: 'Desc B',
          };
          return data[field];
        },
      };

      jest
        .spyOn(GlobalParse.Query.prototype, 'find')
        .mockImplementationOnce(async function () {
          return [fakePlan1, fakePlan2];
        });

      const req: any = {
        params: {},
        headers: {
          'x-parse-session-token': 'valid-token',
        },
      };

      const result = await appointmentPlanFunctions.getAvailableAppointmentPlans(
        req
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      expect(result[0]).toMatchObject({
        id: 'plan1',
        title: 'Plan A',
        duration_minutes: 30,
        price: 100,
        description: 'Desc A',
      });

      expect(result[1]).toMatchObject({
        id: 'plan2',
        title: 'Plan B',
        duration_minutes: 60,
        price: 200,
        description: 'Desc B',
      });
    });
  });
});
