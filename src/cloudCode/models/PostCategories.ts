import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('PostCategories', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class PostCategories extends BaseModel {
  constructor() {
    super('PostCategories');
  }

  @ParseField('Pointer', true, 'ResearchPosts')
  post_id!: 'ResearchPosts';

  @ParseField('Pointer', true, 'ResearchCategories')
  category_id!: 'ResearchCategories';

  @ParseField('Date', false)
  created_at?: Date;

  @ParseField('Date', false)
  updated_at?: Date;
}
