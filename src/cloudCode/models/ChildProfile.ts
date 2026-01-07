import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('ChildProfile', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class ChildProfile extends BaseModel {
  constructor() {
    super('ChildProfile');
  }

  @ParseField('Pointer', true, '_User')
  user!: Parse.Pointer;

  @ParseField('String', true)
  name!: string;

  @ParseField('Date', true)
  birthdate!: Date;

  @ParseField('String', true)
  gender!: string;

  @ParseField('String', false)
  medical_info?: string;
}
