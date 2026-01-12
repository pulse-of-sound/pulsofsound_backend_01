import '../tests/parseMock';
import functions from '../cloudCode/modules/User/functions';

jest.mock('../cloudCode/models/User', () => ({
//اذا كلمة السر او الاسم مفقودين يرمي خطأ
  __esModule: true,
  default: {
    logIn: async (username: string, password: string) => {
      if (!username || !password) throw new Error('Missing credentials');
      return new (global as any).Parse.User();
    },
//شكل الارجاع
    map: (user: any, role: any) => ({
      username: user.get('username'),
      fullName: user.get('fullName'),
      role: role?.get('name') || 'Doctor',
    }),
  },
}));

const { Parse } = global as any;
//اخفاء رسائل الlog
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('UserFunctions', () => {
// loginUser
//كلمة المرور ناقصة
  describe('loginUser', () => {
    it('should throw error if username is missing', async () => {
      const req: any = { params: { password: '123' } };
      await expect(functions.loginUser(req)).rejects.toBeInstanceOf(Error);
    });
//اسم المستخدم ناقص
    it('should throw error if password is missing', async () => {
      const req: any = { params: { username: 'testuser' } };
      await expect(functions.loginUser(req)).rejects.toBeInstanceOf(Error);
    });
//البيانات كاملة وصحيحة
    it('should return sessionToken and user data if credentials are correct', async () => {
      const req: any = { params: { username: 'testuser', password: '123' } };
      const result = await functions.loginUser(req);

      expect(result).toHaveProperty('sessionToken', 'fake-session-token');
      expect(result).toHaveProperty('username', 'testuser');
    });
  });
// logout
//مستخدم لديه sessiontoken
  describe('logout', () => {
    it('should succeed if session token is valid', async () => {
      const user = new Parse.User();
      user.getSessionToken = () => "fake-session-token";
      (user as any)._sessionToken = "fake-session-token";

      const req: any = { user };
      const result = await functions.logout(req);

      expect(result).toHaveProperty('message', 'User logged out successfully');
    });
//مستخدم بدون sessiontoken
    it('should return already logged out if no session token', async () => {
      const req: any = { user: { getSessionToken: () => null } };
      const result = await functions.logout(req);

      expect(result).toHaveProperty('message', 'User is already logged out');
    });
  });
  // updateMyAccount
  describe('updateMyAccount', () => {
//user مفقود
    it('should throw error if user is missing', async () => {
      const req: any = { user: null, params: {} };
      await expect(functions.updateMyAccount(req)).rejects.toBeInstanceOf(Error);
    });
//user موجود مع بيانات جديدة
    it('should update fields if user is provided', async () => {
      const user = new Parse.User();
      user.getSessionToken = () => "fake-session-token";
      (user as any)._sessionToken = "fake-session-token";

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
//ارسلنا طلب بدون بدون sessiontoken
  describe('getAllDoctors', () => {
  it('should throw error if session token is missing', async () => {
    const user = new Parse.User();
    const req: any = { user };

    await expect(functions.getAllDoctors(req)).rejects.toThrow(
      'Session token is required'
    );
  });
});
  // addEditDoctor
//يتحقق من وجود رسالة نجاخ وان الدور هو طبيب وان اسمه doctor1
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
//يتحقق من وجود رسالة نجاخ وان الدور هو اخصائي وان اسمه spec1
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
//انشاء مستخدم اداري جديد ةربطه مع الدور
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
