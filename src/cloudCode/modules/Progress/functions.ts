import Parse from 'parse/node';
import {CloudFunction} from '../../utils/Registry/decorators';

async function _getUser(req: Parse.Cloud.FunctionRequest) {
  console.log('_getUser called');
  console.log('req.user:', req.user ? req.user.id : 'UNDEFINED');

  if (req.user) {
    console.log('User from req.user:', req.user.id);
    return req.user;
  }

  const sessionToken = (req as any).headers?.['x-parse-session-token'];
  console.log(
    ' Session Token from headers:',
    sessionToken ? sessionToken.substring(0, 20) + '...' : 'MISSING'
  );

  if (!sessionToken) {
    console.log(' No session token in headers');
    return null;
  }

  try {
    const sessionQuery = new Parse.Query('_Session');
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});

    if (session && session.get('user')) {
      const user = session.get('user');
      console.log('User from session token:', user.id);
      return user;
    }

    console.log('No valid session found');
    return null;
  } catch (error) {
    console.log(' Error getting user from session:', error);
    return null;
  }
}

class ProgressFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {type: String, required: false},
        user_id: {type: String, required: true},
      },
    },
  })
  async getChildProgress(req: Parse.Cloud.FunctionRequest) {
    try {
      const {child_id, user_id} = req.params;

      if (!user_id) {
        throw {codeStatus: 103, message: 'user_id is required'};
      }

      const targetUserId = child_id || user_id;
      console.log('Target User ID:', targetUserId);

      const https = require('https');
      const http = require('http');

      const appId =
        process.env.APP_ID ||
        'cDUPSpkhbmD0e1TFND3rYkw7TrrdHXqNyXgoOa3PpLPSd5NJb7';
      const masterKey =
        process.env.MASTER_KEY ||
        'He98Mcsc7cTEjut5eE59Oy2gs2dowaNoGWv5QhpzvA7GC3NShY';

      const whereClause = JSON.stringify({
        user_id: {
          __type: 'Pointer',
          className: '_User',
          objectId: targetUserId,
        },
      });

      const queryParams = new URLSearchParams({
        where: whereClause,
        include: 'level_game_id,level_game_id.level_id',
        order: '-createdAt',
        limit: '1000',
      });

      const url = `http://localhost:1337/api/classes/StageResult?${queryParams.toString()}`;
      console.log(' Querying:', url);

      // Make HTTP request
      const results = await new Promise<any[]>((resolve, reject) => {
        http
          .get(
            url,
            {
              headers: {
                'X-Parse-Application-Id': appId,
                'X-Parse-Master-Key': masterKey,
              },
            },
            (res: any) => {
              let data = '';
              res.on('data', (chunk: any) => (data += chunk));
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(data);
                  resolve(parsed.results || []);
                } catch (e) {
                  reject(e);
                }
              });
            }
          )
          .on('error', reject);
      });

      console.log(` Found ${results.length} results via HTTP request`);

      const stats = {
        total_games_played: results.length,
        total_score: 0,
        total_questions: 0,
        average_score: 0,
        levels_progress: {} as any,
        recent_results: [] as any[],
      };

      // Group by level
      const levelMap = new Map();

      for (const result of results) {
        const score = result.score || 0;
        const totalQuestions = result.total_questions || 0;
        const levelGame = result.level_game_id;
        const level = levelGame?.level_id;

        stats.total_score += score;
        stats.total_questions += totalQuestions;

        if (level) {
          const levelId = level.objectId;
          const levelTitle = level.title || 'مرحلة';

          if (!levelMap.has(levelId)) {
            levelMap.set(levelId, {
              level_id: levelId,
              level_title: levelTitle,
              games_played: 0,
              total_score: 0,
              total_questions: 0,
              average_score: 0,
            });
          }

          const levelStats = levelMap.get(levelId);
          levelStats.games_played++;
          levelStats.total_score += score;
          levelStats.total_questions += totalQuestions;
        }
      }

      // Calculate averages
      if (stats.total_questions > 0) {
        stats.average_score = Math.round(
          (stats.total_score / stats.total_questions) * 100
        );
      }

      // Calculate level averages
      for (const [levelId, levelStats] of levelMap.entries()) {
        if (levelStats.total_questions > 0) {
          levelStats.average_score = Math.round(
            (levelStats.total_score / levelStats.total_questions) * 100
          );
        }
        stats.levels_progress[levelId] = levelStats;
      }

      // Get recent 10 results
      stats.recent_results = results.slice(0, 10).map((result: any) => ({
        result_id: result.objectId,
        score: result.score || 0,
        total_questions: result.total_questions || 0,
        percentage: result.total_questions
          ? Math.round((result.score / result.total_questions) * 100)
          : 0,
        level_title: result.level_game_id?.level_id?.title || 'مرحلة',
        game_title: result.level_game_id?.title || 'لعبة',
        created_at: result.createdAt,
      }));

      console.log(' Stats calculated successfully from REST API');
      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      console.error('Error in getChildProgress:', error);
      throw {
        codeStatus: error.codeStatus || 1030,
        message: error.message || 'Failed to fetch child progress',
      };
    }
  }
}

export default new ProgressFunctions();
