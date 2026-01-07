import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('ChatGroup', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class ChatGroup extends BaseModel {
  constructor() {
    super('ChatGroup');
  }

  @ParseField('Pointer', false, 'Appointment')
  appointment_id?: Parse.Object;

  @ParseField('Pointer', false, 'ChildProfile')
  child_id?: Parse.Object;

  @ParseField('String', true)
  chat_type!: string;

  @ParseField('String', false)
  community_name?: string;

  @ParseField('String', false)
  last_message?: string;

  @ParseField('String', true)
  chat_status!: string;

  @ParseField('Date', false)
  created_at?: Date;

  @ParseField('Date', false)
  updated_at?: Date;
}
