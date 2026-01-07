import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('File', {
  clp: {
    find: {requiresAuthentication: true},
    get: {requiresAuthentication: true},
    create: {requiresAuthentication: true},
    update: {requiresAuthentication: true},
    delete: {requiresAuthentication: true},
  },
})
export default class File extends BaseModel {
  constructor() {
    super('File');
  }

  @ParseField('File', false)
  file!: Parse.File;

  @ParseField('Number', false)
  fileSize!: number;

  static map(obj?: File): unknown {
    if (!obj) {
      return undefined;
    }

    let nameWithoutHash = obj.file?.name();
    if (obj.file?.name() && obj.file?.name().length > 33) {
      const hashPattern = /^[a-f0-9]{32}_/;
      if (hashPattern.test(obj.file?.name())) {
        nameWithoutHash = obj.file?.name().substring(33);
      }
    }
    return {
      id: obj.id,
      className: obj.className,
      name: nameWithoutHash,
      url: obj.file?.url(),
      type: obj.file?.name().split('.').pop(),
      size: obj?.fileSize ?? 0,
    };
  }

  static mapList(obj?: File[]): unknown {
    if (!obj || obj.length === 0) {
      return [];
    }
    return obj.map(obj => this.map(obj));
  }
}
