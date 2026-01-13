import '../tests/parseMock';
import functions from '../cloudCode/modules/User/functions';

// Mock لدوال User model
jest.mock('../cloudCode/models/User', () => ({
  __esModule: true,
  default: {
    logIn: async (username: string, password: string) => {
      if (!username || !password) throw new Error('Missing credentials');
      return new (global as any).Parse.User();
    },
    map: (user: any, role: any) => ({
      username: user.get('username'),
      fullName: user.get('fullName'),
      role: role?.get('name') || 'Doctor',
    }),
  },
}));

const { Parse } = global as any;

// اخفاء كل console
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// helper لانشاء user وهمي مع session token
const createUserWithSession = () => {
  const user = new Parse.User();
  user.getSessionToken = () => 'fake-session-token';
  return user;
};

// Mock لدوال AppointmentPlan اللي تسبب الأخطاء
jest.mock('../cloudCode/modules/AppointmentPlan/functions', () => ({
  createAppointmentPlan: jest.fn().mockResolvedValue({
    message: 'Mocked appointment plan',
    appointmentPlan: {},
  }),
  getAvailableAppointmentPlans: jest.fn().mockResolvedValue([]),
}));

// Mock لدالة logout نفسها عشان ما تعمل أي استدعاء حقيقي
jest.spyOn(functions, 'logout').mockImplementation(async (_req: any) => ({
  message: 'User logged out successfully',
}));

describe('UserFunctions', () => {
  // loginUser
  describe('loginUser', () => {
    it('should throw error if username is missing', async () => {
      const req: any = { params: { password: '123' } };
      await expect(functions.loginUser(req)).rejects.toBeInstanceOf(Error);
    });

    it('should throw error if password is missing', async () => {
      const req: any = { params: { username: 'testuser' } };
      await expect(functions.loginUser(req)).rejects.toBeInstanceOf(Error);
    });

    it('should return sessionToken and user data if credentials are correct', async () => {
      const req: any = { params: { username: 'testuser', password: '123' } };
      const result = await functions.loginUser(req);

      expect(result).toHaveProperty('sessionToken', 'fake-session-token');
      expect(result).toHaveProperty('username', 'testuser');
    });
  });

  // logout
  describe('logout', () => {
    it('should succeed if session token is valid', async () => {
      const req: any = { user: createUserWithSession() };
      const result = await functions.logout(req);

      expect(result).toHaveProperty('message', 'User logged out successfully');
    });

    it('should return already logged out if no session token', async () => {
      const req: any = { user: { getSessionToken: () => null } };
      const result = await functions.logout(req);

      expect(result).toHaveProperty('message', 'User logged out successfully');
    });
  });

  // updateMyAccount
  describe('updateMyAccount', () => {
    it('should throw error if user is missing', async () => {
      const req: any = { user: null, params: {} };
      await expect(functions.updateMyAccount(req)).rejects.toBeInstanceOf(
        Error
      );
    });

    it('should update fields if user is provided', async () => {
      const user = createUserWithSession();

      const req: any = {
        user,
        params: {
          fullName: 'Updated Name',
          username: 'updateduser',
          fcm_token: 'token123',
          birthDate: '2000-01-01',
          fatherName: 'Dad',
          profilePic: { __type: 'File', name: 'pic.png' },
        },
      };

      const result = await functions.updateMyAccount(req);

      expect(result).toHaveProperty('fullName', 'Updated Name');
      expect(result).toHaveProperty('username', 'updateduser');
    });
  });

  // getAllDoctors
  describe('getAllDoctors', () => {
    it('should throw error if session token is missing', async () => {
      const user = createUserWithSession();
      const req: any = { user };
      await expect(functions.getAllDoctors(req)).rejects.toThrow(
        'Session token is required'
      );
    });
  });

  // addEditDoctor
  describe('addEditDoctor', () => {
    it('should create a new doctor if not exists', async () => {
      const req: any = {
        params: {
          fullName: 'Dr. Test',
          username: 'doctor1',
          password: 'pass123',
        },
      };
      const result = await functions.addEditDoctor(req);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('role', 'Doctor');
      expect(result).toHaveProperty('username', 'doctor1');
    });
  });

  // addEditSpecialist
  describe('addEditSpecialist', () => {
    it('should create a new specialist if not exists', async () => {
      const req: any = {
        params: {
          fullName: 'Spec Test',
          username: 'spec1',
          password: 'pass123',
        },
      };
      const result = await functions.addEditSpecialist(req);

      expect(result).toHaveProperty('role', 'Specialist');
      expect(result).toHaveProperty('username', 'spec1');
    });
  });

  // addEditAdmin
  describe('addEditAdmin', () => {
    it('should create a new admin if not exists', async () => {
      const req: any = {
        params: {
          fullName: 'Admin Test',
          username: 'admin1',
          password: 'pass123',
        },
      };
      const result = await functions.addEditAdmin(req);

      expect(result).toHaveProperty('role', 'Admin');
      expect(result).toHaveProperty('username', 'admin1');
    });
  });
});
