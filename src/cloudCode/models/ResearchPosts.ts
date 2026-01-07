import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('ResearchPosts', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class ResearchPosts extends BaseModel {
  constructor() {
    super('ResearchPosts');
  }

  @ParseField('String', true)
  title!: string;

  @ParseField('String', true)
  body!: string;

  @ParseField('String', true)
  status!: string;

  @ParseField('String', false)
  rejection_reason?: string;

  @ParseField('String', false)
  keywords?: string;

  @ParseField('Pointer', false, '_User')
  author_id?: Parse.User;

  @ParseField('File', false)
  document?: Parse.File;

  @ParseField('Date', false)
  created_at?: Date;

  @ParseField('Date', false)
  updated_at?: Date;
}
