import {CloudFunction} from '../../utils/Registry/decorators';
import StageQuestion from '../../models/StageQuestion';
import LevelGame from '../../models/LevelGame';

class StageQuestionFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        level_game_id: {required: true, type: String},
        questions: {required: true, type: Array},
      },
    },
  })
  async addQuestionsToStage(req: Parse.Cloud.FunctionRequest) {
    try {
      const {level_game_id, questions} = req.params;

      const stagePointer = await new Parse.Query(LevelGame)
        .equalTo('objectId', level_game_id)
        .first({useMasterKey: true});

      if (!stagePointer) {
        throw {
          codeStatus: 404,
          message: 'LevelGame (stage) not found',
        };
      }

      const savedQuestions: any[] = [];

      for (let index = 0; index < questions.length; index++) {
        const q = questions[index];
        const {question_type, instruction, images, correct_answer, options} = q;

        const question = new StageQuestion();
        question.set('level_game_id', stagePointer);
        question.set('question_type', question_type);
        question.set('order', index);
        if (instruction) question.set('instruction', instruction);
        if (images) question.set('images', images);
        if (correct_answer) question.set('correct_answer', correct_answer);
        if (options) question.set('options', options);
        question.set('created_at', new Date());
        question.set('updated_at', new Date());

        await question.save(null, {useMasterKey: true});
        savedQuestions.push(question.toJSON());
      }

      return {
        message: 'Questions added successfully',
        count: savedQuestions.length,
        questions: savedQuestions,
      };
    } catch (error: any) {
      console.error('Error in addQuestionsToStage:', error);
      throw {
        codeStatus: error.codeStatus || 1001,
        message: error.message || 'Failed to add questions to stage',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        question_ids: {required: true, type: Array},
      },
    },
  })
  async deleteStageQuestionsByIds(req: Parse.Cloud.FunctionRequest) {
    try {
      const {question_ids} = req.params;

      const query = new Parse.Query(StageQuestion);
      query.containedIn('objectId', question_ids);

      const results = await query.find({useMasterKey: true});

      if (results.length === 0) {
        return {
          message: 'No matching questions found',
          deleted_count: 0,
        };
      }

      for (const question of results) {
        await question.destroy({useMasterKey: true});
      }

      return {
        message: 'Questions deleted successfully',
        deleted_count: results.length,
        deleted_ids: question_ids,
      };
    } catch (error: any) {
      console.error('Error in deleteStageQuestionsByIds:', error);
      throw {
        codeStatus: error.codeStatus || 1002,
        message: error.message || 'Failed to delete stage questions',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        level_game_id: {required: true, type: String},
      },
    },
  })
  async getStageQuestions(req: Parse.Cloud.FunctionRequest) {
    try {
      const {level_game_id} = req.params;
      const user = req.user;

      let isAdmin = false;
      if (user) {
        const roleQuery = new Parse.Query(Parse.Role);
        roleQuery.equalTo('name', 'Admin');
        roleQuery.equalTo('users', user);
        isAdmin = !!(await roleQuery.first({useMasterKey: true}));
      }

      const query = new Parse.Query(StageQuestion);
      query.equalTo('level_game_id', {
        __type: 'Pointer',
        className: 'LevelGame',
        objectId: level_game_id,
      });
      query.ascending('order');

      const results = await query.find({useMasterKey: true});

      const questions = results.map(q => {
        return {
          objectId: q.id,
          question_type: q.get('question_type'),
          instruction: q.get('instruction'),
          images: q.get('images'),
          options: q.get('options') || null,
          correct_answer: q.get('correct_answer') || null,
        };
      });

      return {
        message: 'Stage questions fetched successfully',
        count: questions.length,
        questions,
      };
    } catch (error: any) {
      console.error('Error in getStageQuestions:', error);
      throw {
        codeStatus: error.codeStatus || 1003,
        message: error.message || 'Failed to fetch stage questions',
      };
    }
  }
}

export default new StageQuestionFunctions();
