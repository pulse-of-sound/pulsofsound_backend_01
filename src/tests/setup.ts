import 'reflect-metadata';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as any).mockRestore?.();
});

// import 'reflect-metadata';

// beforeAll(() => {
//   jest.spyOn(console, 'error').mockImplementation(() => {});
// });

// afterAll(() => {
//   (console.error as any).mockRestore?.();
// });

// // كلاس وهمي يمثل Parse.Object
// class MockParseObject {
//   private data: Record<string, any> = {};

//   async save() {
//     return this;
//   }

//   set(key: string, value: any) {
//     this.data[key] = value;
//   }

//   get(key: string) {
//     return this.data[key];
//   }
// }

// // كلاس وهمي يمثل Parse.Query
// class MockParseQuery {
//   private conditions: Record<string, any> = {};

//   equalTo(key: string, value: any) {
//     this.conditions[key] = value;
//   }

//   async find() {
//     return [];
//   }
// }

// // نعرّف Parse كـ global object
// (global as any).Parse = {
//   Object: MockParseObject,
//   Query: MockParseQuery,
//   Cloud: {
//     FunctionRequest: class {}
//   }
// };
