import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('Reports', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class Reports extends BaseModel {
  constructor() {
    super('Reports');
  }

  @ParseField('Pointer', true, 'Appointment')
  appointment_id!: Parse.Object;

  @ParseField('Pointer', true, '_User')
  author_id!: Parse.Object;

  @ParseField('Pointer', false, 'ChildProfile')
  child_id?: Parse.Object;

  @ParseField('Pointer', true, '_User')
  provider_id!: Parse.Object;

  @ParseField('Pointer', false, '_User')
  doctor_id?: Parse.Object;

  @ParseField('Pointer', false, '_User')
  parent_id?: Parse.Object;

  @ParseField('String', true)
  content!: string;

  @ParseField('String', true)
  report_content!: string;

  @ParseField('String', false)
  summary?: string;

  @ParseField('Object', false)
  tags?: any;
}
