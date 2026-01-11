import {CloudFunction} from '../../utils/Registry/decorators';
import PlacementTestQuestion from '../../models/PlacementTestQuestion';
import PlacementTestCorrectAnswer from '../../models/PlacementTestCorrectAnswer';
class PlacementTestFunctions {
//جلب اسئلة اختبار الذكاء
  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: false,
      fields: {},
    },
  })
  async getPlacementTestQuestions(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];

      if (!sessionToken) {
        throw {codeStatus: 141, message: 'Session token is required'};
      }

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});

      if (!session) {
        throw {codeStatus: 141, message: 'Invalid session token'};
      }

      const user = session.get('user');
      if (!user) {
        throw {codeStatus: 141, message: 'User not found'};
      }

      const rolePointer = user.get('role');
      const role = await new Parse.Query(Parse.Role)
        .equalTo('objectId', rolePointer?.id)
        .first({useMasterKey: true});

      const roleName = role?.get('name');
      if (roleName !== 'Child') {
        throw {codeStatus: 102, message: 'User is not a Child'};
      }

      const query = new Parse.Query(PlacementTestQuestion);
      query.ascending('createdAt');
      const results = await query.find({useMasterKey: true});

      const formatted = results.map(q => {
        const getFileUrl = (fileObj: any) => {
          if (!fileObj) return null;

          if (fileObj instanceof Parse.File) {
            return fileObj.url();
          }

          if (typeof fileObj?.url === 'function') {
            return fileObj.url();
          }

          if (fileObj?._url) {
            return fileObj._url;
          }

          if (typeof fileObj === 'string') {
            return fileObj;
          }

          if (typeof fileObj === 'object' && fileObj.name) {
            return `${process.env.publicServerURL}/files/${fileObj.name}`;
          }

          return null;
        };

        return {
          id: q.id,
          question_image_url: getFileUrl(q.get('question_image_url')),
          options: {
            A: getFileUrl(q.get('option_a_image_url')),
            B: getFileUrl(q.get('option_b_image_url')),
            C: getFileUrl(q.get('option_c_image_url')),
            D: getFileUrl(q.get('option_d_image_url')),
          },
        };
      });

      return formatted;
    } catch (error: any) {
      console.error('Error in getPlacementTestQuestions:', error);
      throw {
        codeStatus: error.codeStatus || 1000,
        message: error.message || 'Failed to retrieve placement test questions',
      };
    }
  }
//جلب سؤال عن طريق index
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
    },
  })
  async getPlacementTestQuestionByIndex(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = req.user;
      const index = req.params.index;

      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const rolePointer = user.get('role');
      const role = await new Parse.Query(Parse.Role)
        .equalTo('objectId', rolePointer?.id)
        .first({useMasterKey: true});

      const roleName = role?.get('name');
      if (roleName !== 'Child') {
        throw {codeStatus: 102, message: 'User is not a Child'};
      }

      const query = new Parse.Query(PlacementTestQuestion);
      query.ascending('createdAt');
      query.skip(index);
      query.limit(1);
      const result = await query.first({useMasterKey: true});
      if (!result) {
        throw {codeStatus: 104, message: 'No question found at this index'};
      }

      const getFileUrl = (fileObj: any) => {
        if (!fileObj) return null;
        if (typeof fileObj === 'object' && fileObj.name) {
          return `${process.env.publicServerURL}/files/${fileObj.name}`;
        }
        return fileObj?.url?.() || fileObj?.url || null;
      };

      return {
        id: result.id,
        question_image_url: getFileUrl(result.get('question_image_url')),
        options: {
          A: getFileUrl(result.get('option_a_image_url')),
          B: getFileUrl(result.get('option_b_image_url')),
          C: getFileUrl(result.get('option_c_image_url')),
          D: getFileUrl(result.get('option_d_image_url')),
        },
      };
    } catch (error: any) {
      console.error('Error in getPlacementTestQuestionByIndex:', error);
      throw {
        codeStatus: error.codeStatus || 1000,
        message: error.message || 'Failed to retrieve question by index',
      };
    }
  }
//تطابق الاجابات وارجاع نتيجة
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        answers: {type: Array, required: true},
      },
    },
  })
  async submitPlacementTestAnswers(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];

      if (!sessionToken) {
        throw new Parse.Error(141, 'Session token is required');
      }

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});

      if (!session) {
        throw new Parse.Error(141, 'Invalid session token');
      }

      const user = session.get('user');
      if (!user) {
        throw new Parse.Error(141, 'User not found');
      }

      const {answers} = req.params;
      console.log('=== submitPlacementTestAnswers ===');
      console.log('Received answers:', answers);

      let correctCount = 0;

      for (const {questionId, selectedOption} of answers) {
        const questionPointer = new Parse.Object('PlacementTestQuestion');
        questionPointer.id = questionId;

        const answerQuery = new Parse.Query(PlacementTestCorrectAnswer);
        answerQuery.equalTo('question', questionPointer);
        const correctAnswer = await answerQuery.first({useMasterKey: true});

        const dbCorrectOption = correctAnswer
          ?.get('correct_option')
          ?.trim()
          .toUpperCase();
        const userOption = selectedOption.trim().toUpperCase();
        const isCorrect = dbCorrectOption === userOption;

        console.log(
          `Question ${questionId}: Expected=${dbCorrectOption}, Got=${userOption}, Correct=${isCorrect}`
        );

        if (isCorrect) correctCount++;
      }
//يعتبر ناجح اذا كان <70
      const score = Math.round((correctCount / answers.length) * 100);
      const passed = score >= 70;

      console.log(
        `Final Result: ${correctCount}/${answers.length} (${score}%)`
      );

      user.set('placement_test_score', score);
      await user.save(null, {useMasterKey: true});

      return {correctCount, score, passed};
    } catch (error: any) {
      console.error('Error in submitPlacementTestAnswers:', error);
      throw error;
    }
  }
}

export default new PlacementTestFunctions();
