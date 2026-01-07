import {BaseModel} from '../utils/BaseModel';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';

@ParseClass('UserStageStatus', {
  clp: {
    find: {'*': true},
    get: {'*': true},
    create: {'*': true},
    update: {'*': true},
    delete: {'*': true},
  },
})
export default class UserStageStatus extends BaseModel {
  constructor() {
    super('UserStageStatus');
  }

  @ParseField('Pointer', true, '_User')
  user_id!: Parse.User;

  @ParseField('Pointer', true, 'LevelGame')
  level_game_id!: Parse.Object;

  @ParseField('String', false)
  status?: 'in_progress' | 'completed' | 'skipped';

  @ParseField('Date', false)
  completed_at?: Date;

  @ParseField('Number', false)
  score?: number;

  @ParseField('Number', false)
  attempts?: number;

  @ParseField('Number', false)
  current_stage?: number;

  @ParseField('Date', false)
  last_play_date?: Date;
}
