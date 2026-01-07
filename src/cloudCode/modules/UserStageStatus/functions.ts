import {CloudFunction} from '../../utils/Registry/decorators';
import UserStageStatus from '../../models/UserStageStatus';
import LevelGame from '../../models/LevelGame';
import ChildProfile from '../../models/ChildProfile';

class UserStageStatusFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        level_game_id: {required: true, type: String},
        score: {required: false, type: Number},
      },
    },
  })
  async markStageCompleted(req: Parse.Cloud.FunctionRequest) {
    try {
      const {level_game_id, score} = req.params;
      const user = req.user;

      if (!user) {
        throw {
          codeStatus: 401,
          message: 'Unauthorized: user not found',
        };
      }

      const stagePointer = await new Parse.Query(LevelGame)
        .equalTo('objectId', level_game_id)
        .first({useMasterKey: true});

      if (!stagePointer) {
        throw {
          codeStatus: 404,
          message: 'LevelGame not found',
        };
      }

      const statusQuery = new Parse.Query(UserStageStatus);
      statusQuery.equalTo('user_id', user);
      statusQuery.equalTo('level_game_id', stagePointer);
      const existing = await statusQuery.first({useMasterKey: true});

      const now = new Date();

      if (existing) {
        existing.set('status', 'completed');
        existing.set('completed_at', now);
        if (score !== undefined) existing.set('score', score);
        existing.increment('attempts', 1);
        await existing.save(null, {useMasterKey: true});
      } else {
        const status = new UserStageStatus();
        status.set('user_id', user);
        status.set('level_game_id', stagePointer);
        status.set('status', 'completed');
        status.set('completed_at', now);
        status.set('attempts', 1);
        if (score !== undefined) status.set('score', score);
        await status.save(null, {useMasterKey: true});
      }

      return {
        message: 'Stage marked as completed successfully',
      };
    } catch (error: any) {
      console.error('Error in markStageCompleted:', error);
      throw {
        codeStatus: error.codeStatus || 1006,
        message: error.message || 'Failed to mark stage as completed',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
    },
  })
  async getUserStageStatus(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = req.user;

      if (!user) {
        throw {
          codeStatus: 401,
          message: 'Unauthorized: user not found',
        };
      }

      const query = new Parse.Query(UserStageStatus);
      query.equalTo('user_id', user);
      query.include('level_game_id');
      query.descending('completed_at');
      const statuses = await query.find({useMasterKey: true});

      const result = statuses.map(status => {
        const stage = status.get('level_game_id') as Parse.Object;
        return {
          level_game_id: stage?.id,
          stage_title: stage?.get('title'),
          status: status.get('status'),
          score: status.get('score') || 0,
          attempts: status.get('attempts') || 0,
          completed_at: status.get('completed_at') || null,
        };
      });

      return {
        message: 'User stage statuses fetched successfully',
        count: result.length,
        stages: result,
      };
    } catch (error: any) {
      console.error('Error in getUserStageStatus:', error);
      throw {
        codeStatus: error.codeStatus || 1008,
        message: error.message || 'Failed to fetch user stage statuses',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        level_game_id: {required: true, type: String},
      },
    },
  })
  async resetStageProgress(req: Parse.Cloud.FunctionRequest) {
    try {
      const {level_game_id} = req.params;
      const user = req.user;

      if (!user) {
        throw {
          codeStatus: 401,
          message: 'Unauthorized: user not found',
        };
      }

      const stagePointer = await new Parse.Query(LevelGame)
        .equalTo('objectId', level_game_id)
        .first({useMasterKey: true});

      if (!stagePointer) {
        throw {
          codeStatus: 404,
          message: 'LevelGame not found',
        };
      }

      const statusQuery = new Parse.Query(UserStageStatus);
      statusQuery.equalTo('user_id', user);
      statusQuery.equalTo('level_game_id', stagePointer);
      const existing = await statusQuery.first({useMasterKey: true});

      if (existing) {
        existing.set('status', 'in_progress');
        existing.set('score', 0);
        existing.set('attempts', 0);
        existing.set('completed_at', null);
        await existing.save(null, {useMasterKey: true});
      } else {
        const status = new UserStageStatus();
        status.set('user_id', user);
        status.set('level_game_id', stagePointer);
        status.set('status', 'in_progress');
        status.set('score', 0);
        status.set('attempts', 0);
        status.set('completed_at', null);
        await status.save(null, {useMasterKey: true});
      }

      return {
        message: 'Stage progress reset successfully',
      };
    } catch (error: any) {
      console.error('Error in resetStageProgress:', error);
      throw {
        codeStatus: error.codeStatus || 1009,
        message: error.message || 'Failed to reset stage progress',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        level_game_id: {required: true, type: String},
        new_status: {required: true, type: String},
        score: {required: false, type: Number},
        target_user_id: {required: true, type: String},
      },
    },
  })
  async adminOverrideStageStatus(req: Parse.Cloud.FunctionRequest) {
    try {
      const {level_game_id, new_status, score, target_user_id} = req.params;
      const admin = req.user;

      if (!admin) {
        throw {
          codeStatus: 401,
          message: 'Unauthorized: admin not found',
        };
      }

      const roleQuery = new Parse.Query(Parse.Role);
      roleQuery.equalTo('users', admin);
      const roles = await roleQuery.find({useMasterKey: true});
      const isAdmin = roles.some(role => role.get('name') === 'Admin');

      if (!isAdmin) {
        throw {
          codeStatus: 403,
          message: 'Forbidden: only admins can override stage status',
        };
      }

      const targetUser = await new Parse.Query(Parse.User)
        .equalTo('objectId', target_user_id)
        .first({useMasterKey: true});

      if (!targetUser) {
        throw {
          codeStatus: 404,
          message: 'Target user not found',
        };
      }

      const stagePointer = await new Parse.Query(LevelGame)
        .equalTo('objectId', level_game_id)
        .first({useMasterKey: true});

      if (!stagePointer) {
        throw {
          codeStatus: 404,
          message: 'LevelGame not found',
        };
      }

      const statusQuery = new Parse.Query(UserStageStatus);
      statusQuery.equalTo('user_id', targetUser);
      statusQuery.equalTo('level_game_id', stagePointer);
      const existing = await statusQuery.first({useMasterKey: true});

      const now = new Date();

      if (existing) {
        existing.set('status', new_status);
        if (new_status === 'completed') {
          existing.set('completed_at', now);
        } else {
          existing.set('completed_at', null);
        }
        if (score !== undefined) existing.set('score', score);
        await existing.save(null, {useMasterKey: true});
      } else {
        const status = new UserStageStatus();
        status.set('user_id', targetUser);
        status.set('level_game_id', stagePointer);
        status.set('status', new_status);
        status.set('attempts', 0);
        if (new_status === 'completed') {
          status.set('completed_at', now);
        }
        if (score !== undefined) status.set('score', score);
        await status.save(null, {useMasterKey: true});
      }

      return {
        message: 'Stage status overridden successfully',
        new_status,
        target_user_id,
      };
    } catch (error: any) {
      console.error('Error in adminOverrideStageStatus:', error);
      throw {
        codeStatus: error.codeStatus || 1010,
        message: error.message || 'Failed to override stage status',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {required: true, type: String},
        level_game_id: {required: true, type: String},
      },
    },
  })
  async getStageProgressForGroup(req: Parse.Cloud.FunctionRequest) {
    try {
      const {child_id, level_game_id} = req.params;

      const userQuery = new Parse.Query(Parse.User);
      const user = await userQuery.get(child_id, {useMasterKey: true});

      if (!user) {
        throw {
          codeStatus: 404,
          message: 'User not found',
        };
      }
      const levelGame = await new Parse.Query(LevelGame)
        .equalTo('objectId', level_game_id)
        .first({useMasterKey: true});

      if (!levelGame) {
        throw {
          codeStatus: 404,
          message: 'Level game not found',
        };
      }
      const cpQuery = new Parse.Query(ChildProfile);
      cpQuery.equalTo('user', user);
      const childProfile = await cpQuery.first({useMasterKey: true});
      const globalLastPlayDate = childProfile
        ? childProfile.get('last_play_date')
        : null;

      const statusQuery = new Parse.Query(UserStageStatus);
      statusQuery.equalTo('user_id', user);
      statusQuery.equalTo('level_game_id', levelGame);
      const status = await statusQuery.first({useMasterKey: true});

      if (!status) {
        return {
          message: 'No progress found for this group',
          current_stage: 0,
          last_play_date: null,
          global_last_play_date: globalLastPlayDate,
          completed: false,
        };
      }

      return {
        message: 'Stage progress fetched successfully',
        current_stage: status.get('current_stage') || 0,
        last_play_date: status.get('last_play_date') || null,
        global_last_play_date: globalLastPlayDate,
        completed: status.get('status') === 'completed',
        attempts: status.get('attempts') || 0,
        score: status.get('score') || 0,
      };
    } catch (error: any) {
      console.error('Error in getStageProgressForGroup:', error);
      throw {
        codeStatus: error.codeStatus || 1011,
        message: error.message || 'Failed to fetch stage progress',
      };
    }
  }
}

export default new UserStageStatusFunctions();
