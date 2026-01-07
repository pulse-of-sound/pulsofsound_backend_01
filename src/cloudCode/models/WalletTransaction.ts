import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('WalletTransaction', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class WalletTransaction extends BaseModel {
  constructor() {
    super('WalletTransaction');
  }

  @ParseField('Pointer', false, 'Wallet')
  from_wallet?: Parse.Object;

  @ParseField('Pointer', true, 'Wallet')
  to_wallet!: Parse.Object;

  @ParseField('Number', true)
  amount!: number;

  @ParseField('String', true)
  type!: string;

  @ParseField('Pointer', false, 'Appointment')
  appointment_id?: Parse.Object;

  @ParseField('Date', false)
  created_at?: Date;

  @ParseField('Date', false)
  updated_at?: Date;
}
