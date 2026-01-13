import 'reflect-metadata';
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});


const mockUser = () => ({
  id: 'user-id',
  get: (key: string) => {
    if (key === 'username') return 'testuser';
    if (key === 'role') return {get: () => 'Doctor'};
    return null;
  },
  set: jest.fn(),
  unset: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
  getSessionToken: () => 'fake-session-token',
});

const mockRole = (name: string) => ({
  id: `role-${name}`,
  get: (key: string) => (key === 'name' ? name : null),
});

const mockSession = () => ({
  get: (key: string) => (key === 'user' ? mockUser() : null),
  destroy: jest.fn().mockResolvedValue(true),
});

(global as any).Parse = {
  User: {
    logIn: jest.fn().mockResolvedValue(mockUser()),
  },

  Role: function () {},

  Session: function () {},

  Query: jest.fn().mockImplementation(cls => {
    return {
      equalTo: jest.fn().mockReturnThis(),
      notEqualTo: jest.fn().mockReturnThis(),
      containedIn: jest.fn().mockReturnThis(),
      include: jest.fn().mockReturnThis(),
      ascending: jest.fn().mockReturnThis(),

      first: jest
        .fn()
        .mockResolvedValue(
          cls === (global as any).Parse.Session
            ? mockSession()
            : cls === (global as any).Parse.Role
            ? mockRole('Doctor')
            : null
        ),

      find: jest.fn().mockResolvedValue([mockUser()]),
    };
  }),

  ACL: jest.fn(),

  Error: class ParseError extends Error {
    static OBJECT_NOT_FOUND = 101;
    static OTHER_CAUSE = 141;

    constructor(code: number, message: string) {
      super(message);
      (this as any).code = code;
    }
  },
};

afterAll(() => {
  (console.error as any).mockRestore?.();
});
