import {CloudFunction} from '../../utils/Registry/decorators';
import LevelGame from '../../models/LevelGame';
import ChildLevel from '../../models/ChildLevel';

class LevelGameFunctions {
//إضافة مرحلة عن طريق الادمن
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        levelId: {required: true, type: String},
        name: {required: true, type: String},
        order: {required: true, type: Number},
      },
    },
  })
  async addLevelGameByAdmin(req: Parse.Cloud.FunctionRequest) {
    try {
      const {levelId, name, order} = req.params;

      const levelPointer = new Parse.Object('Level');
      levelPointer.id = levelId;

      const existing = await new Parse.Query(LevelGame)
        .equalTo('level_id', levelPointer)
        .equalTo('order', order)
        .first({useMasterKey: true});

      if (existing) {
        throw {
          codeStatus: 102,
          message: 'LevelGame with this order already exists in this level',
        };
      }

      const levelGame = new LevelGame();
      levelGame.set('level_id', levelPointer);
      levelGame.set('name', name);
      levelGame.set('order', order);
      levelGame.set('created_at', new Date());
      levelGame.set('updated_at', new Date());

      await levelGame.save(null, {useMasterKey: true});

      return {
        message: 'LevelGame added successfully',
        levelGame: levelGame.toJSON(),
      };
    } catch (error: any) {
      console.error('Error in addLevelGameByAdmin:', error);
      throw {
        codeStatus: error.codeStatus || 1002,
        message: error.message || 'Failed to add level game',
      };
    }
  }
//جلب كل الالعاب الخاصة بمستوى معين
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        level_id: {required: true, type: String},
      },
    },
  })
  async getLevelGamesForLevel(req: Parse.Cloud.FunctionRequest) {
    try {
      const {level_id} = req.params;

      const levelPointer = new Parse.Object('Level');
      levelPointer.id = level_id;

      const query = new Parse.Query(LevelGame);
      query.equalTo('level_id', levelPointer);
      query.ascending('order');

      const results = await query.find({useMasterKey: true});

      const stages = results.map(stage => ({
        objectId: stage.id,
        name: stage.get('name'),
        description: stage.get('description'),
        order: stage.get('order'),
        level_id: level_id,
      }));

      return {
        message: 'Level games fetched successfully',
        stages,
      };
    } catch (error: any) {
      console.error('Error in getLevelGamesForLevel:', error);
      throw {
        codeStatus: error.codeStatus || 1001,
        message: error.message || 'Failed to fetch level games',
      };
    }
  }
//نتحقق هل هنالك مرحلة تالية بعد الحالية داخل مستوى معين
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        level_id: {required: true, type: String},
        current_order: {required: true, type: Number},
      },
    },
  })
  async getNextStageOrder(req: Parse.Cloud.FunctionRequest) {
    const {level_id, current_order} = req.params;

    const levelPointer = new Parse.Object('Level');
    levelPointer.id = level_id;

    const query = new Parse.Query(LevelGame);
    query.equalTo('level_id', levelPointer);
    query.equalTo('order', current_order + 1);

    const nextStage = await query.first({useMasterKey: true});

    if (!nextStage) {
      return {
        completed: true,
        message: 'Child has completed all stages in this level',
      };
    }

    return {
      completed: false,
      message: 'Next stage found',
      next_stage: {
        objectId: nextStage.id,
        name: nextStage.get('name'),
        order: nextStage.get('order'),
      },
    };
  }
//يقرر هل الطفل سينتقل للمرحلة التالية أم سيعيد الحالية
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
  async advanceOrRepeatStage(req: Parse.Cloud.FunctionRequest) {
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

    let answerRecord: any = await answerQuery.first({useMasterKey: true});

    if (!answerRecord) {
      const ChildStageAnswers = Parse.Object.extend('ChildStageAnswers');
      answerRecord = new ChildStageAnswers();
      answerRecord.set('child_id', childProfile);
      answerRecord.set('stage_id', stagePointer);
      answerRecord.set('score', 100);
      answerRecord.set('is_completed', true);
      answerRecord.set('answered_at', new Date());
      await answerRecord.save(null, {useMasterKey: true});
    }

    const isCompleted = answerRecord.get('is_completed') === true;

    if (!isCompleted) {
      return {
        repeat: true,
        message: 'Stage not completed. Child must repeat this stage.',
      };
    }

    const currentStage = await new Parse.Query(LevelGame)
      .equalTo('objectId', stage_id)
      .first({useMasterKey: true});

    if (!currentStage) {
      throw {
        codeStatus: 404,
        message: 'Stage not found',
      };
    }

    const currentOrder = currentStage.get('order');
    const level = currentStage.get('level_id');

    const nextStageQuery = new Parse.Query(LevelGame);
    nextStageQuery.equalTo('level_id', level);
    nextStageQuery.equalTo('order', currentOrder + 1);

    const nextStage = await nextStageQuery.first({useMasterKey: true});

    const childLevelQuery = new Parse.Query(ChildLevel);
    childLevelQuery.equalTo('child_id', childProfile);
    childLevelQuery.equalTo('level_id', level);

    const childLevel = await childLevelQuery.first({useMasterKey: true});

    if (!childLevel) {
      throw {
        codeStatus: 404,
        message: 'ChildLevel record not found',
      };
    }
//يجب الانتظار 24 ساعة لفتح المرحلة التالية
    const lastCompletedAt = childLevel.get('last_completed_at');
    if (lastCompletedAt) {
      const now = new Date();
      const hoursSince =
        (now.getTime() - lastCompletedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return {
          wait: true,
          message: `You must wait ${Math.ceil(
            24 - hoursSince
          )} more hours before unlocking the next stage`,
        };
      }
    }

    if (!nextStage) {
      return {
        completed: true,
        message: 'Child has completed all stages in this level',
      };
    }

    childLevel.set('current_game_order', currentOrder + 1);
    childLevel.set('last_completed_at', new Date());
    await childLevel.save(null, {useMasterKey: true});

    return {
      advanced: true,
      message: 'Child advanced to next stage',
      next_stage: {
        objectId: nextStage.id,
        name: nextStage.get('name'),
        order: nextStage.get('order'),
      },
    };
  }
}

export default new LevelGameFunctions();
