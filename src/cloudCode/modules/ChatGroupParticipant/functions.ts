import ChatGroupParticipant from '../../models/ChatGroupParticipant';
import {CloudFunction} from '../../utils/Registry/decorators';

async function _getUser(req: Parse.Cloud.FunctionRequest) {
  if (req.user) return req.user;

  const sessionToken = (req as any).headers?.['x-parse-session-token'];
  if (!sessionToken) return null;

  const sessionQuery = new Parse.Query(Parse.Session);
  sessionQuery.equalTo('sessionToken', sessionToken);
  sessionQuery.include('user');
  const session = await sessionQuery.first({useMasterKey: true});
  return session?.get('user') || null;
}

class ChatGroupParticipantFunctions {
//حذف شخص ما من الدردشة
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_group_id: {type: String, required: true},
        participant_id: {type: String, required: true},
      },
    },
  })
  async removeParticipantFromGroup(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_group_id, participant_id} = req.params;

      const roleObject = user.get('role');
      const systemRole = roleObject?.get('name');

      if (!['Admin', 'SuperAdmin'].includes(systemRole)) {
        throw {
          codeStatus: 403,
          message:
            'Unauthorized: You must be Admin or SuperAdmin to remove participants',
        };
      }

      const participantQuery = new Parse.Query(ChatGroupParticipant);
      participantQuery.equalTo(
        'chat_group_id',
        new Parse.Object('ChatGroup', {id: chat_group_id})
      );
      participantQuery.equalTo(
        'user_id',
        new Parse.Object('_User', {id: participant_id})
      );

      const participant = await participantQuery.first({useMasterKey: true});
      if (!participant) {
        throw {
          codeStatus: 404,
          message: 'Participant not found in this group',
        };
      }

      await participant.destroy({useMasterKey: true});

      return {
        message: 'Participant removed successfully',
        participant_id,
        chat_group_id,
      };
    } catch (error: any) {
      console.error('Error in removeParticipantFromGroup:', error);
      throw {
        codeStatus: error.codeStatus || 1020,
        message: error.message || 'Failed to remove participant',
      };
    }
  }
//وضع شخص في وضع ميوت
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        chat_group_id: {type: String, required: true},
        participant_id: {type: String, required: true},
        duration_in_days: {type: Number, required: true},
      },
    },
  })
  async muteParticipant(req: Parse.Cloud.FunctionRequest) {
    try {
      const rawUser = await _getUser(req);
      if (!rawUser) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const user = await new Parse.Query('_User')
        .include('role')
        .get(rawUser.id, {useMasterKey: true});

      const roleObject = user.get('role');
      const systemRole = roleObject?.get('name');

      if (!['Admin', 'SuperAdmin'].includes(systemRole)) {
        throw {
          codeStatus: 403,
          message:
            'Unauthorized: You must be Admin or SuperAdmin to mute participants',
        };
      }

      const {chat_group_id, participant_id, duration_in_days} = req.params;

      const participantQuery = new Parse.Query(ChatGroupParticipant);
      participantQuery.equalTo(
        'chat_group_id',
        new Parse.Object('ChatGroup', {id: chat_group_id})
      );
      participantQuery.equalTo(
        'user_id',
        new Parse.Object('_User', {id: participant_id})
      );

      const participant = await participantQuery.first({useMasterKey: true});
      if (!participant) {
        throw {
          codeStatus: 404,
          message: 'Participant not found in this group',
        };
      }

      const now = new Date();
      const muteUntil = new Date(
        now.getTime() + duration_in_days * 24 * 60 * 60 * 1000
      );

      participant.set('is_muted', true);
      participant.set('mute_until', muteUntil);
      await participant.save(null, {useMasterKey: true});

      return {
        message: 'Participant muted successfully',
        participant_id,
        chat_group_id,
        mute_until: muteUntil,
      };
    } catch (error: any) {
      console.error('Error in muteParticipant:', error);
      throw {
        codeStatus: error.codeStatus || 1021,
        message: error.message || 'Failed to mute participant',
      };
    }
  }
//رفع وضع ميوت من على مستخدم معين
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        chat_group_id: {type: String, required: true},
        participant_id: {type: String, required: true},
      },
    },
  })
  async unmuteParticipant(req: Parse.Cloud.FunctionRequest) {
    try {
      const rawUser = await _getUser(req);
      if (!rawUser) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const user = await new Parse.Query('_User')
        .include('role')
        .get(rawUser.id, {useMasterKey: true});

      const roleObject = user.get('role');
      const systemRole = roleObject?.get('name');

      if (!['Admin', 'SuperAdmin'].includes(systemRole)) {
        throw {
          codeStatus: 403,
          message:
            'Unauthorized: You must be Admin or SuperAdmin to unmute participants',
        };
      }

      const {chat_group_id, participant_id} = req.params;

      const participantQuery = new Parse.Query(ChatGroupParticipant);
      participantQuery.equalTo(
        'chat_group_id',
        new Parse.Object('ChatGroup', {id: chat_group_id})
      );
      participantQuery.equalTo(
        'user_id',
        new Parse.Object('_User', {id: participant_id})
      );

      const participant = await participantQuery.first({useMasterKey: true});
      if (!participant) {
        throw {
          codeStatus: 404,
          message: 'Participant not found in this group',
        };
      }

      participant.set('is_muted', false);
      participant.set('mute_until', null);
      await participant.save(null, {useMasterKey: true});

      return {
        message: 'Participant unmuted successfully',
        participant_id,
        chat_group_id,
      };
    } catch (error: any) {
      console.error('Error in unmuteParticipant:', error);
      throw {
        codeStatus: error.codeStatus || 1022,
        message: error.message || 'Failed to unmute participant',
      };
    }
  }
//جلب جميع المستخدمين ل شات ما
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_group_id: {type: String, required: true},
      },
    },
  })
  async getParticipantsInGroup(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_group_id} = req.params;

      const query = new Parse.Query(ChatGroupParticipant);
      query.equalTo(
        'chat_group_id',
        new Parse.Object('ChatGroup', {id: chat_group_id})
      );
      query.include(['user_id', 'user_id.role']);
      query.limit(1000);

      const participants = await query.find({useMasterKey: true});

      const formatted = participants.map(p => {
        const u = p.get('user_id');
        const roleObject = u?.get('role');
        return {
          participant_id: u?.id,
          username: u?.get('username'),
          role: roleObject?.get('name') || null,
          is_muted: p.get('is_muted'),
          mute_until: p.get('mute_until') || null,
        };
      });

      return {
        message: 'Participants retrieved successfully',
        chat_group_id,
        participants: formatted,
      };
    } catch (error: any) {
      console.error('Error in getParticipantsInGroup:', error);
      throw {
        codeStatus: error.codeStatus || 1025,
        message: error.message || 'Failed to retrieve participants',
      };
    }
  }
}

export default new ChatGroupParticipantFunctions();
