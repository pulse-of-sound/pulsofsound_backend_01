import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('Admin')
export default class Admin extends Parse.Object {
  @ParseField('String', true)
  username!: string;

  @ParseField('String', true)
  password!: string;

  @ParseField('String', false)
  fullName?: string;

  @ParseField('String', false)
  role?: string;

  @ParseField('String', false)
  mobile?: string;

  @ParseField('String', false)
  email?: string;

  @ParseField('Boolean', false)
  isActive?: boolean;
}
