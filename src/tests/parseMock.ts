// parseMock.ts
class FakeFile {
  constructor(public name: string) {}
  async save() {
    return this;
  }
  url() {
    return `https://fake.parse/files/${this.name}`;
  }
  toJSON() {
    return {__type: 'File', name: this.name};
  }
  static fromJSON(obj: any) {
    return new FakeFile(obj.name);
  }
}

class FakeRole {
  id: string;
  constructor(private name: string) {
    this.id = 'role-' + name;
  }

  get(field: string) {
    if (field === 'name') return this.name;
    return null;
  }

  toPointer() {
    return {__type: 'Pointer', className: '_Role', objectId: this.id};
  }

  relation() {
    return {
      add: () => {},
      query: () => ({include: () => {}, find: async () => []}),
    };
  }

  async save() {
    return this;
  }
}

class FakeUser {
  id = 'user1';
  attributes: any = {username: 'testuser', fullName: 'Test User'};
  role: FakeRole = new FakeRole('Admin');

  get(field: string) {
    if (field === 'role') return this.role;
    return this.attributes[field];
  }

  set(field: string, value: any) {
    this.attributes[field] = value;
  }
  unset(field: string) {
    delete this.attributes[field];
  }
  getSessionToken() {
    return 'fake-session-token';
  }

  async save() {
    return this;
  }
  async signUp() {
    return this;
  }
  async fetchWithInclude() {
    return this;
  }

  static async logIn(username: string, password: string) {
    if (!username || !password) throw new Error('Missing credentials');
    return new FakeUser();
  }

  static map(user: any, role: any) {
    return {
      id: user.id,
      username: user.get('username'),
      fullName: user.get('fullName'),
      role: role?.get('name') ?? null,
    };
  }
}

class FakeSession {
  user: any;
  constructor(user?: any) { this.user = user || new (global as any).Parse.User(); }

  get(field: string) {
    if (field === 'user') return this.user;
    return null;
  }

  async destroy() { return true; }
}


class FakeQuery {
  private _field?: string;
  private _value?: string;

  equalTo(field: string, value: string) {
    this._field = field;
    this._value = value;
    return this;
  }
  notEqualTo() {
    return this;
  }
  containedIn() {
    return this;
  }
  include() {
    return this;
  }
  ascending() {
    return this;
  }
  descending() {
    return this;
  }
  greaterThan() {
    return this;
  }

  async first() {
    if (this._field === 'name') {
      const roles = ['Admin', 'Doctor', 'Specialist', 'Child'];
      if (roles.includes(this._value!)) return new FakeRole(this._value!);
    }
    return null;
  }

  async find() {
    return [];
  }
}

class FakeParseError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
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
