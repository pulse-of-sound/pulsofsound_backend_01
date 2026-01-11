import {CloudFunction} from '../../utils/Registry/decorators';
import StageQuestion from '../../models/StageQuestion';
import LevelGame from '../../models/LevelGame';
import StageResult from '../../models/StageResult';
import UserStageStatus from '../../models/UserStageStatus';
import ChildLevel from '../../models/ChildLevel';
import Level from '../../models/Level';

interface AnswerInput {
  question_id: string;
  answer: any;
}

class StageResultFunctions {
//تستقبل اجابات طفل 
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {required: true, type: String},
        level_game_id: {required: true, type: String},
        answers: {required: true, type: Array},
      },
    },
  })
  async submitStageAnswers(req: Parse.Cloud.FunctionRequest) {
    try {
      console.log('submitStageAnswers called');
      const {child_id, level_game_id} = req.params;
      const answers = req.params.answers as AnswerInput[];

      console.log(' Child ID:', child_id);
      console.log(' Level Game ID:', level_game_id);
      console.log(' Answers:', JSON.stringify(answers));

// الحصول على المستخدم من child_id
      const userQuery = new Parse.Query(Parse.User);
      const user = await userQuery.get(child_id, {useMasterKey: true});

      if (!user) {
        console.log(' User not found');
        throw {
          codeStatus: 404,
          message: 'User not found',
        };
      }

      console.log(' User found:', user.id);

      const stagePointer = await new Parse.Query(LevelGame)
        .equalTo('objectId', level_game_id)
        .first({useMasterKey: true});

      if (!stagePointer) {
        console.log(' LevelGame not found');
        throw {
          codeStatus: 404,
          message: 'LevelGame not found',
        };
      }

      console.log(' LevelGame found:', stagePointer.id);

      const questionIds = answers.map((a: AnswerInput) => a.question_id);
      const query = new Parse.Query(StageQuestion);
      query.containedIn('objectId', questionIds);
      const stageQuestions = await query.find({useMasterKey: true});

      let correctCount = 0;

      for (const answerObj of answers) {
        const question = stageQuestions.find(
          q => q.id === answerObj.question_id
        );
        if (!question) continue;

        const correct = question.get('correct_answer');
        const type = question.get('question_type');
        const userAnswer = answerObj.answer;

        if (!correct || type === 'view_only') continue;

        if (type === 'choose' && correct.index === userAnswer) {
          correctCount++;
        } else if (type === 'match') {
          const correctPairs = correct.pairs || [];
          const userPairs = userAnswer || [];
          const match =
            correctPairs.length === userPairs.length &&
            correctPairs.every(
              (pair: any, i: number) =>
                pair.left === userPairs[i].left &&
                pair.right === userPairs[i].right
            );
          if (match) correctCount++;
        } else if (type === 'classify') {
          const correctBoy = correct.boy || [];
          const correctGirl = correct.girl || [];
          const userBoy = userAnswer.boy || [];
          const userGirl = userAnswer.girl || [];
          const match =
            JSON.stringify(correctBoy.sort()) ===
              JSON.stringify(userBoy.sort()) &&
            JSON.stringify(correctGirl.sort()) ===
              JSON.stringify(userGirl.sort());
          if (match) correctCount++;
        }
      }

      const result = new StageResult();
      result.set('user_id', user);
      result.set('level_game_id', stagePointer);
      result.set('score', correctCount);
      result.set('total_questions', stageQuestions.length);
      result.set('answers', answers);
      result.set('created_at', new Date());
      result.set('updated_at', new Date());

      await result.save(null, {useMasterKey: true});
      console.log(' StageResult saved successfully:', result.id);
      console.log(' Score:', correctCount, '/', stageQuestions.length);

      const statusQuery = new Parse.Query(UserStageStatus);
      statusQuery.equalTo('user_id', user);
      statusQuery.equalTo('level_game_id', stagePointer);
      const existingStatus = await statusQuery.first({useMasterKey: true});

      const now = new Date();

      if (existingStatus) {
        existingStatus.set('status', 'completed');
        existingStatus.set('completed_at', now);
        existingStatus.set('score', correctCount);
        existingStatus.set('last_play_date', now);
        existingStatus.increment('attempts', 1);
        existingStatus.increment('current_stage', 1);
        await existingStatus.save(null, {useMasterKey: true});
        console.log(
          'UserStageStatus updated: current_stage =',
          existingStatus.get('current_stage')
        );
      } else {
        const newStatus = new UserStageStatus();
        newStatus.set('user_id', user);
        newStatus.set('level_game_id', stagePointer);
        newStatus.set('status', 'completed');
        newStatus.set('completed_at', now);
        newStatus.set('score', correctCount);
        newStatus.set('attempts', 1);
        newStatus.set('current_stage', 1);
        newStatus.set('last_play_date', now);
        await newStatus.save(null, {useMasterKey: true});
        console.log('UserStageStatus created: current_stage = 1');
      }

      let childProfile;
      try {
        const childProfileQuery = new Parse.Query('ChildProfile');
        childProfileQuery.equalTo('user', user);
        childProfile = await childProfileQuery.first({useMasterKey: true});

        if (childProfile) {
          childProfile.set('last_play_date', now);
          await childProfile.save(null, {useMasterKey: true});
          console.log(
            ' Updated global last_play_date on ChildProfile for user:',
            user.id
          );
        } else {
          console.log(' ChildProfile not found for global date update');
        }
      } catch (cpError) {
        console.error(
          '❌د Error updating ChildProfile last_play_date:',
          cpError
        );
      }

      try {
        const currentStageNum = existingStatus
          ? existingStatus.get('current_stage')
          : 1;

        if (currentStageNum > 10 && childProfile) {
          const childLevelQuery = new Parse.Query(ChildLevel);
          childLevelQuery.equalTo('child_id', childProfile);
          let childLevel = await childLevelQuery.first({useMasterKey: true});

          if (!childLevel) {
            console.log(' ChildLevel not found, creating new one...');
            const firstLevel = await new Parse.Query(Level)
              .ascending('order')
              .first({useMasterKey: true});
            if (firstLevel) {
              childLevel = new ChildLevel();
              childLevel.set('child_id', childProfile);
              childLevel.set('level_id', firstLevel);
              childLevel.set('current_game_order', 1);
              await childLevel.save(null, {useMasterKey: true});
              console.log(' Created new ChildLevel with order 1');
            }
          }

          if (childLevel) {
            const currentGroupOrder = childLevel.get('current_game_order');
            const playedGroupOrder = stagePointer.get('order');

            // تأكد من أننا نلعب في المجموعة الحالية قبل التحديث
            if (playedGroupOrder === currentGroupOrder) {
              childLevel.increment('current_game_order', 1);
              await childLevel.save(null, {useMasterKey: true});
              console.log(
                '🎉 Group Completed! Advanced to Group Order:',
                currentGroupOrder + 1
              );
            }
          }
        }
      } catch (lvlError) {
        console.error(' Error advancing ChildLevel:', lvlError);
      }

      return {
        message: 'Stage answers submitted and status updated successfully',
        score: correctCount,
        total: stageQuestions.length,
      };
    } catch (error: any) {
      console.error('Error in submitStageAnswers:', error);
      throw {
        codeStatus: error.codeStatus || 1004,
        message: error.message || 'Failed to submit stage answers',
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
  async getStageResult(req: Parse.Cloud.FunctionRequest) {
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

      const resultQuery = new Parse.Query(StageResult);
      resultQuery.equalTo('user_id', user);
      resultQuery.equalTo('level_game_id', stagePointer);
      resultQuery.descending('createdAt');
      const result = await resultQuery.first({useMasterKey: true});

      if (!result) {
        throw {
          codeStatus: 404,
          message: 'No result found for this stage',
        };
      }

      const score = result.get('score') || 0;
      const total = result.get('total_questions') || 0;
      const percent = total > 0 ? Math.round((score / total) * 100) : 0;

      let evaluation = 'بحاجة إلى تحسين';
      if (percent >= 80) evaluation = 'ممتاز';
      else if (percent >= 50) evaluation = 'جيد';

      const nextStageQuery = new Parse.Query(LevelGame);
      nextStageQuery.greaterThan('order', stagePointer.get('order'));
      nextStageQuery.equalTo('level_id', stagePointer.get('level_id'));
      nextStageQuery.ascending('order');
      const nextStage = await nextStageQuery.first({useMasterKey: true});

      let nextStep: any = null;

      if (nextStage) {
        nextStep = {
          type: 'stage',
          level_id: nextStage.get('level_id').id,
          level_game_id: nextStage.id,
          title: nextStage.get('title'),
        };
      } else {
        const nextLevelQuery = new Parse.Query('Level');
        nextLevelQuery.greaterThan(
          'order',
          stagePointer.get('level_id').get('order')
        );
        nextLevelQuery.ascending('order');
        const nextLevel = await nextLevelQuery.first({useMasterKey: true});

        if (nextLevel) {
          nextStep = {
            type: 'level',
            level_id: nextLevel.id,
            title: nextLevel.get('title'),
          };
        }
      }

      return {
        message: 'Stage result fetched successfully',
        score,
        total,
        percent,
        evaluation,
        nextStep,
      };
    } catch (error: any) {
      console.error('Error in getStageResult:', error);
      throw {
        codeStatus: error.codeStatus || 1005,
        message: error.message || 'Failed to fetch stage result',
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
  async getStageHistory(req: Parse.Cloud.FunctionRequest) {
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

      const resultQuery = new Parse.Query(StageResult);
      resultQuery.equalTo('user_id', user);
      resultQuery.equalTo('level_game_id', stagePointer);
      resultQuery.descending('createdAt');
      const results = await resultQuery.find({useMasterKey: true});

      const history = results.map(result => ({
        score: result.get('score') || 0,
        total: result.get('total_questions') || 0,
        percent: result.get('total_questions')
          ? Math.round(
              (result.get('score') / result.get('total_questions')) * 100
            )
          : 0,
        created_at: result.get('created_at') || result.createdAt,
        answers: result.get('answers') || [],
      }));

      return {
        message: 'Stage history fetched successfully',
        attempts: history.length,
        history,
      };
    } catch (error: any) {
      console.error('Error in getStageHistory:', error);
      throw {
        codeStatus: error.codeStatus || 1007,
        message: error.message || 'Failed to fetch stage history',
      };
    }
  }
}

export default new StageResultFunctions();
