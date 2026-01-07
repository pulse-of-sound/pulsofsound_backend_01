import {CloudFunction} from '../../utils/Registry/decorators';
import ChildLevel from '../../models/ChildLevel';
import ChildProfile from '../../models/ChildProfile';
import Level from '../../models/Level';
import {catchError} from '../../utils/catchError';
import LevelGame from '../../models/LevelGame';

class ChildLevelFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        child_id: {type: String, required: true},
      },
    },
  })
  async assignChildLevelIfPassed(req: Parse.Cloud.FunctionRequest) {
    const {child_id} = req.params;
    const user = req.user;

    if (!user) {
      throw {
        codeStatus: 5001,
        message: 'Unauthorized: user not found',
      };
    }

    const score = user.get('placement_test_score');
    if (typeof score !== 'number') {
      throw {
        codeStatus: 5002,
        message: 'Placement test score is missing or invalid',
      };
    }

    if (score < 70) {
      return {
        passed: false,
        message: 'Child did not pass. Training required.',
      };
    }

    const childProfile = await new Parse.Query(ChildProfile)
      .equalTo('objectId', child_id)
      .include('parent_id')
      .include('user')
      .first({useMasterKey: true});

    if (!childProfile) {
      throw {
        codeStatus: 5003,
        message: 'ChildProfile not found',
      };
    }

    const parent = childProfile.get('parent_id');
    const directUser = childProfile.get('user');

    const isChild = user.id === child_id;
    const isParent =
      (parent && user.id === parent.id) ||
      (directUser && user.id === directUser.id);

    if (!isChild && !isParent) {
      throw {
        codeStatus: 5006,
        message: 'Access denied: not child or parent',
      };
    }

    const firstLevel = await new Parse.Query(Level)
      .ascending('order')
      .first({useMasterKey: true});

    if (!firstLevel) {
      throw {
        codeStatus: 5004,
        message: 'No levels found in system',
      };
    }

    const existing = await new Parse.Query(ChildLevel)
      .equalTo('child_id', childProfile)
      .first({useMasterKey: true});

    const childLevel = existing || new ChildLevel();
    childLevel.set('child_id', childProfile);
    childLevel.set('level_id', firstLevel);
    childLevel.set('current_game_order', 1);

    const [error, saved] = await catchError(
      childLevel.save(null, {useMasterKey: true})
    );

    if (error) {
      throw {
        codeStatus: 5005,
        message: 'Error saving ChildLevel data',
      };
    }

    return {
      passed: true,
      message: 'Child level assigned successfully',
      childLevel: {
        objectId: saved.id,
        child_id: childProfile.id,
        level_id: firstLevel.id,
        current_game_order: 1,
      },
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {type: String, required: true},
      },
    },
  })
  async getCurrentStageForChild(req: Parse.Cloud.FunctionRequest) {
    try {
      const {child_id} = req.params;

      // لا نحتاج للتحقق من user نستخدم child_id مباشرة
      const userQuery = new Parse.Query(Parse.User);
      const childUser = await userQuery.get(child_id, {useMasterKey: true});

      if (!childUser) {
        throw {codeStatus: 404, message: 'Child user not found'};
      }

      // البحث عن ChildProfile باستخدام user pointer
      let childProfile = await new Parse.Query(ChildProfile)
        .equalTo('user', childUser)
        .first({useMasterKey: true});

      if (!childProfile) {
        console.log(
          'ChildProfile not found for user:',
          child_id,
          '- creating one'
        );
        childProfile = new ChildProfile();
        childProfile.set('user', childUser);
        childProfile.set('name', childUser.get('fullName') || 'Child');
        childProfile.set('gender', 'Unknown');
        childProfile.set('birthdate', new Date());
        await childProfile.save(null, {useMasterKey: true});
        console.log(' ChildProfile created:', childProfile.id);
      }

      const childLevelQuery = new Parse.Query(ChildLevel);
      childLevelQuery.equalTo('child_id', childProfile);
      childLevelQuery.include('level_id');
      const childLevel = await childLevelQuery.first({useMasterKey: true});

      if (!childLevel) {
        return {
          message: 'No level assigned yet',
          stage: null,
        };
      }

      const level = childLevel.get('level_id');
      const currentOrder = childLevel.get('current_game_order');

      if (!level || currentOrder === undefined) {
        throw {codeStatus: 400, message: 'Invalid level or game order'};
      }

      const gameQuery = new Parse.Query(LevelGame);
      gameQuery.equalTo('level_id', level);
      gameQuery.equalTo('order', currentOrder);
      const currentStage = await gameQuery.first({useMasterKey: true});

      if (!currentStage) {
        throw {codeStatus: 404, message: 'Current stage not found'};
      }

      return {
        message: 'Current stage fetched successfully',
        stage: {
          objectId: currentStage.id,
          title: currentStage.get('title'),
          order: currentStage.get('order'),
          level_id: level.id,
        },
      };
    } catch (error: any) {
      console.error('Error in getCurrentStageForChild:', error);
      throw {
        codeStatus: error.codeStatus || 1001,
        message: error.message || 'Failed to fetch current stage',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        child_id: {type: String, required: true},
        stage_id: {type: String, required: true},
        passed: {type: Boolean, required: true},
      },
    },
  })
  async advanceOrRepeatStage(req: Parse.Cloud.FunctionRequest) {
    const {child_id, stage_id, passed} = req.params;
    const user = req.user;
    if (!user) {
      throw {
        codeStatus: 401,
        message: 'Unauthorized: user not found',
      };
    }

    const childProfile = await new Parse.Query('ChildProfile')
      .equalTo('objectId', child_id)
      .include('parent_id')
      .include('user')
      .first({useMasterKey: true});

    if (!childProfile) {
      throw {codeStatus: 404, message: 'Child not found'};
    }

    const parent = childProfile.get('parent_id');
    const directUser = childProfile.get('user');
    const isChild = user.id === child_id;
    const isParent =
      (parent && user.id === parent.id) ||
      (directUser && user.id === directUser.id);

    if (!isChild && !isParent) {
      throw {codeStatus: 403, message: 'Access denied: not child or parent'};
    }

    const childLevel = await new Parse.Query('ChildLevel')
      .equalTo('child_id', childProfile)
      .include('level_id')
      .first({useMasterKey: true});

    if (!childLevel) {
      throw {codeStatus: 404, message: 'ChildLevel not found'};
    }

    const currentOrder = childLevel.get('current_game_order');
    const level = childLevel.get('level_id');

    const totalStages = await new Parse.Query('LevelGame')
      .equalTo('level_id', level)
      .count({useMasterKey: true});

    if (passed) {
      if (currentOrder < totalStages) {
        childLevel.set('current_game_order', currentOrder + 1);
        await childLevel.save(null, {useMasterKey: true});
        return {
          advanced: true,
          message: 'Child advanced to next stage',
          new_order: currentOrder + 1,
        };
      } else {
        return {
          advanced: true,
          message: 'Child has completed all stages in this level',
          new_order: currentOrder,
        };
      }
    } else {
      return {
        advanced: false,
        message: 'Child will repeat the current stage',
        new_order: currentOrder,
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {type: String, required: true},
      },
    },
  })
  async getLevelCompletionStatus(req: Parse.Cloud.FunctionRequest) {
    const {child_id} = req.params;

    const userQuery = new Parse.Query(Parse.User);
    const childUser = await userQuery.get(child_id, {useMasterKey: true});

    if (!childUser) {
      throw {
        codeStatus: 404,
        message: 'Child user not found',
      };
    }

    let childProfile = await new Parse.Query('ChildProfile')
      .equalTo('user', childUser)
      .first({useMasterKey: true});

    if (!childProfile) {
      console.log(
        'ChildProfile not found for user:',
        child_id,
        '- creating one'
      );
      const ChildProfile = Parse.Object.extend('ChildProfile');
      const newProfile = new ChildProfile();
      newProfile.set('user', childUser);
      newProfile.set('name', childUser.get('fullName') || 'Child');
      newProfile.set('gender', 'Unknown');
      newProfile.set('birthdate', new Date());
      await newProfile.save(null, {useMasterKey: true});
      console.log('ChildProfile created:', newProfile.id);
      childProfile = newProfile;
    }

    if (!childProfile) {
      throw {
        codeStatus: 500,
        message: 'Failed to get or create child profile',
      };
    }

    const childLevel = await new Parse.Query('ChildLevel')
      .equalTo('child_id', childProfile)
      .include('level_id')
      .first({useMasterKey: true});

    if (!childLevel) {
      return {
        completed: false,
        message: 'No level assigned yet',
        current_order: 0,
        total_stages: 0,
      };
    }

    const currentOrder = childLevel.get('current_game_order');
    const level = childLevel.get('level_id');

    const totalStages = await new Parse.Query('LevelGame')
      .equalTo('level_id', level)
      .count({useMasterKey: true});

    if (currentOrder >= totalStages) {
      return {
        completed: true,
        message: 'Child has completed all stages in this level',
      };
    } else {
      return {
        completed: false,
        message: 'Child is still progressing through the level',
        current_order: currentOrder,
        total_stages: totalStages,
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        child_id: {required: true, type: String},
        stage_id: {required: true, type: String},
      },
    },
  })
  async getStageCompletionStatus(req: Parse.Cloud.FunctionRequest) {
    const {child_id, stage_id} = req.params;
    const user = req.user;

    if (!user) {
      throw {
        codeStatus: 401,
        message: 'Unauthorized: user not found',
      };
    }

    const childProfile = await new Parse.Query('ChildProfile')
      .equalTo('objectId', child_id)
      .include('parent_id')
      .include('user')
      .first({useMasterKey: true});

    if (!childProfile) {
      throw {
        codeStatus: 404,
        message: 'Child not found',
      };
    }

    const parent = childProfile.get('parent_id');
    const directUser = childProfile.get('user');
    const isChild = user.id === child_id;
    const isParent =
      (parent && user.id === parent.id) ||
      (directUser && user.id === directUser.id);

    if (!isChild && !isParent) {
      throw {
        codeStatus: 403,
        message: 'Access denied: not child or parent',
      };
    }

    const stagePointer = new Parse.Object('LevelGame');
    stagePointer.id = stage_id;

    const answerQuery = new Parse.Query('ChildStageAnswers');
    answerQuery.equalTo('child_id', childProfile);
    answerQuery.equalTo('stage_id', stagePointer);

    const answerRecord = await answerQuery.first({useMasterKey: true});

    if (!answerRecord) {
      return {
        completed: false,
        message: 'Stage not yet attempted',
      };
    }

    const isCompleted = answerRecord.get('is_completed') === true;

    return {
      completed: isCompleted,
      message: isCompleted
        ? 'Stage completed successfully'
        : 'Stage attempted but not completed',
    };
  }
}

export default new ChildLevelFunctions();
