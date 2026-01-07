import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('TrainingQuestionCorrectAnswer', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class TrainingQuestionCorrectAnswer extends BaseModel {
  constructor() {
    super('TrainingQuestionCorrectAnswer');
  }

  @ParseField('Pointer', true, 'TrainingQuestion')
  question!: Parse.Pointer;

  @ParseField('String', true)
  correct_option!: string;

  @ParseField('Date', false)
  created_at?: Date;

  @ParseField('Date', false)
  updated_at?: Date;
}
