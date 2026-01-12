//محاكاة Parse.File
class FakeFile {
  constructor(public name: string) {}

  save() {
    return Promise.resolve(this);
  }

  url() {
    return `https://fake.parse/files/${this.name}`;
  }

  toJSON() {
    return { __type: 'File', name: this.name };
  }

  static fromJSON(obj: any) {
    return new FakeFile(obj.name);
  }
}
//محاكاة Parse.Role
class FakeRole {
  constructor(public name: string) {}

  get(field: string) {
    return field === 'name' ? this.name : null;
  }

  relation() {
    return {
      add: (_user: any) => {},
      query: () => ({
        include: () => {},
        find: async () => [new FakeUser()],
      }),
    };
  }

  async save(_data?: any, _options?: any) {
    return this;
  }

  toPointer() {
    return { __type: 'Pointer', className: 'Role', objectId: 'role1' };
  }
}
//محاكاة Parse.User
class FakeUser {
  id = 'u1';
  attributes: any = {
    username: 'testuser',
    fullName: 'Test User',
  };

  role = new FakeRole('Doctor');

  getSessionToken() {
    return 'fake-session-token';
  }

  get(field: string) {
    if (field === 'role') return this.role;
    return this.attributes[field];
  }

  set(field: string, val: any) {
    this.attributes[field] = val;
  }

  unset(field: string) {
    delete this.attributes[field];
  }

  async save(_data?: any, _options?: any) {
    return this;
  }

  async signUp(_?: any, __?: any) {
    return this;
  }

  async fetchWithInclude(_fields?: any, _opts?: any) {
    return this;
  }

  static async logIn(username: string, password: string) {
    if (!username || !password) throw new Error('Missing credentials');
    return new FakeUser();
  }
}
//محاكاة Parse.Session
class FakeSession {
  async destroy() {
    return true;
  }
}
//محاكاة Parse.Query
class FakeQuery {
  constructor(public target?: any) {}

  equalTo() { return this; }
  notEqualTo() { return this; }
  containedIn() { return this; }
  include() { return this; }
  ascending(_field?: string) { return this; }

  relation() {
    return {
      query: () => ({
        include: () => {},
        find: async () => [new FakeUser()],
      }),
    };
  }

  async first() {
    if (this.target === FakeSession) return new FakeSession();
    if (this.target === FakeRole) return new FakeRole('Doctor');

//  لا يوجد مستخدم بنفس كلمة السر
    if (this.target === FakeUser) return null;

    return null;
  }

  async find() {
    return [new FakeUser()];
  }
}

class FakeParseError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }

  static OTHER_CAUSE = 141;
}

class FakeACL {}

(global as any).Parse = {
  User: FakeUser,
  Role: FakeRole,
  Session: FakeSession,
  Query: FakeQuery,
  File: FakeFile,
  ACL: FakeACL,
  Error: FakeParseError,
};

export {
  FakeUser,
  FakeRole,
  FakeSession,
  FakeQuery,
  FakeFile,
  FakeParseError,
  FakeACL,
};
