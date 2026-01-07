import {CloudFunction} from '../../utils/Registry/decorators';
import TrainingQuestion from '../../models/TrainingQuestion';
import TrainingQuestionCorrectAnswer from '../../models/TrainingQuestionCorrectAnswer';

const sessionAnswers: Record<
  string,
  {correctCount: number; currentIndex: number}
> = {};

class TrainingFlowFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        question_id: {type: String, required: true},
        selected_option: {type: String, required: true},
      },
    },
  })
  async getNextTrainingQuestion(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];

    if (!sessionToken) {
      throw new Error('Session token is required');
    }

    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});

    if (!session) {
      throw new Error('Invalid session token');
    }

    const user = session.get('user');
    if (!user) {
      throw new Error('User not found');
    }

    const userId = user.id;
    const {question_id, selected_option} = req.params;

    if (!question_id || !sessionAnswers[userId]) {
      sessionAnswers[userId] = {correctCount: 0, currentIndex: 0};
    }

    const session_data = sessionAnswers[userId];

    let isCorrect = false;

    if (question_id) {
      const answerQuery = new Parse.Query(TrainingQuestionCorrectAnswer);
      answerQuery.equalTo('question', {
        __type: 'Pointer',
        className: 'TrainingQuestion',
        objectId: question_id,
      });
      const correctAnswer = await answerQuery.first({useMasterKey: true});

      isCorrect =
        correctAnswer?.get('correct_option')?.trim().toUpperCase() ===
        selected_option.trim().toUpperCase();

      if (isCorrect) session_data.correctCount++;

      session_data.currentIndex++;

      if (session_data.currentIndex >= 15) {
        const result = {
          message: `أجبت على ${session_data.correctCount} من 15 بشكل صحيح.`,
          options: ['إعادة اختبار الذكاء', 'متابعة التدريب'],
        };

        delete sessionAnswers[userId];

        return result;
      }
    }

    const questionQuery = new Parse.Query(TrainingQuestion);
    questionQuery.ascending('createdAt');
    questionQuery.skip(session_data.currentIndex);
    questionQuery.limit(1);
    const next = await questionQuery.first({useMasterKey: true});

    if (!next) throw {code: 404, message: 'لا يوجد سؤال تدريبي متاح'};

    const getFileUrl = (fileObj: any) => {
      if (fileObj)
        console.log(
          `DEBUG: TrainingQuestion image object: ${JSON.stringify(fileObj)}`
        );

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

      const appId =
        process.env.appId ||
        'cDUPSpkhbmD0e1TFND3rYkw7TrrdHXqNyXgoOa3PpLPSd5NJb7';
      const baseUrl = process.env.publicServerURL;

      if (typeof fileObj === 'string') {
        if (fileObj.startsWith('http')) return fileObj;
        return `${baseUrl}/files/${appId}/${fileObj}`;
      }

      if (typeof fileObj === 'object' && fileObj.name) {
        return `${baseUrl}/files/${appId}/${fileObj.name}`;
      }

      return null;
    };

    return {
      question_id: next.id,
      question_image_url: getFileUrl(next.get('question_image_url')),
      options: {
        A: getFileUrl(next.get('option_a')),
        B: getFileUrl(next.get('option_b')),
        C: getFileUrl(next.get('option_c')),
      },
      current_index: session_data.currentIndex,
      is_previous_correct: isCorrect,
    };
  }
}

export default new TrainingFlowFunctions();
