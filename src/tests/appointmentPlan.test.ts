import '../tests/parseMock';
import appointmentPlanFunctions from '../cloudCode/modules/AppointmentPlan/functions';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
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

jest.mock('../cloudCode/modules/AppointmentPlan/functions', () => ({
  createAppointmentPlan: jest.fn().mockResolvedValue({
    message: 'Appointment plan created successfully',
    appointmentPlan: {
      title: 'Plan A',
      duration_minutes: 30,
      price: 100,
      description: 'Test plan',
    },
  }),
  getAvailableAppointmentPlans: jest.fn().mockResolvedValue([
    {
      id: 'plan1',
      title: 'Plan A',
      duration_minutes: 30,
      price: 100,
      description: 'Desc A',
    },
    {
      id: 'plan2',
      title: 'Plan B',
      duration_minutes: 60,
      price: 200,
      description: 'Desc B',
    },
  ]),
}));

describe('AppointmentPlanFunctions', () => {
  describe('createAppointmentPlan', () => {
    it('should create appointment plan successfully', async () => {
      const req: any = {
        params: {
          title: 'Plan A',
          duration_minutes: 30,
          price: 100,
          description: 'Test plan',
        },
        headers: {
          'x-parse-session-token': 'any-token',
        },
      };

      const result = await appointmentPlanFunctions.createAppointmentPlan(req);

      expect(result).toHaveProperty(
        'message',
        'Appointment plan created successfully'
      );
      expect(result).toHaveProperty('appointmentPlan');
      expect(result.appointmentPlan).toHaveProperty('title', 'Plan A');
      expect(result.appointmentPlan).toHaveProperty('duration_minutes', 30);
      expect(result.appointmentPlan).toHaveProperty('price', 100);
    });
  });

  describe('getAvailableAppointmentPlans', () => {
    it('should return list of appointment plans', async () => {
      const req: any = {
        params: {},
        headers: {
          'x-parse-session-token': 'any-token',
        },
      };

      const result =
        await appointmentPlanFunctions.getAvailableAppointmentPlans(req);

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
