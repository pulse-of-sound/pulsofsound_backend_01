export default class EmptyModel {
  id = 'mock-id';
  attributes: any = {};

  set(key: string, value: any) {
    this.attributes[key] = value;
  }

  get(key: string) {
    return this.attributes[key];
  }

  toJSON() {
    return { objectId: this.id, ...this.attributes };
  }

  async save() {
    return this;
  }
}
