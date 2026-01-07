import {CloudFunction} from '../../utils/Registry/decorators';
import ChatGroup from '../../models/ChatGroup';
import ChatGroupParticipant from '../../models/ChatGroupParticipant';
import Appointment from '../../models/Appointment';

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

class ChatGroupFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
      },
    },
  })
  async createChatGroupForAppointment(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {appointment_id} = req.params;

      const appointment = await new Parse.Query(Appointment)
        .include(['user_id', 'provider_id', 'child_id'])
        .get(appointment_id, {useMasterKey: true});

      if (!appointment) {
        throw {codeStatus: 104, message: 'Appointment not found'};
      }

      const provider = appointment.get('provider_id');
      const requester = appointment.get('user_id');

      const isParticipant =
        provider?.id === user.id || requester?.id === user.id;

      if (!isParticipant) {
        throw {
          codeStatus: 102,
          message: 'Unauthorized: You are not part of this appointment',
        };
      }

      const existingGroup = await new Parse.Query(ChatGroup)
        .equalTo('appointment_id', appointment)
        .first({useMasterKey: true});

      if (existingGroup) {
        return {
          message: 'Chat group already exists for this appointment',
          chat_group_id: existingGroup.id,
        };
      }

      const chatGroup = new ChatGroup();
      chatGroup.set('appointment_id', appointment);
      chatGroup.set('child_id', appointment.get('child_id'));
      chatGroup.set('chat_type', 'private');
      chatGroup.set('chat_status', 'active');
      await chatGroup.save(null, {useMasterKey: true});

      const participants = [provider, requester];
      for (const participant of participants) {
        const chatParticipant = new ChatGroupParticipant();
        chatParticipant.set('chat_group_id', chatGroup);
        chatParticipant.set('user_id', participant);
        await chatParticipant.save(null, {useMasterKey: true});
      }

      return {
        message: 'Chat group created successfully',
        chat_group_id: chatGroup.id,
      };
    } catch (error: any) {
      console.error('Error in createChatGroupForAppointment:', error);
      throw {
        codeStatus: error.codeStatus || 1009,
        message: error.message || 'Failed to create chat group for appointment',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getMyChatGroups(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const participantQuery = new Parse.Query(ChatGroupParticipant);
      participantQuery.equalTo('user_id', user);
      participantQuery.include([
        'chat_group_id',
        'chat_group_id.appointment_id',
        'chat_group_id.appointment_id.user_id',
        'chat_group_id.appointment_id.provider_id',
        'chat_group_id.child_id',
      ]);
      participantQuery.limit(50);

      const results = await participantQuery.find({useMasterKey: true});

      const privateGroups = await Promise.all(
        results.map(async participant => {
          const group = participant.get('chat_group_id');
          if (!group) return null;

          const appointment = group.get('appointment_id');
          const child = group.get('child_id');

          let chatStatus = group.get('chat_status') || 'active';
          if (chatStatus === 'active' && appointment) {
            try {
              const plan = await appointment
                .get('appointment_plan_id')
                ?.fetch({useMasterKey: true});
              if (plan) {
                const durationMinutes = plan.get('duration_minutes');
                if (durationMinutes) {
                  const startTime = group.createdAt.getTime();
                  const currentTime = new Date().getTime();
                  const elapsedMinutes =
                    (currentTime - startTime) / (1000 * 60);

                  if (elapsedMinutes > durationMinutes) {
                    group.set('chat_status', 'archived');
                    await group.save(null, {useMasterKey: true});
                    chatStatus = 'archived';
                  }
                }
              }
            } catch (e) {
              console.log('Error checking chat duration:', e);
            }
          }

          return {
            objectId: group.id,
            chat_type: group.get('chat_type'),
            chat_status: chatStatus,
            last_message: group.get('last_message'),
            createdAt: group.createdAt,
            appointment: appointment
              ? {
                  objectId: appointment.id,
                  user_id: {
                    id: appointment.get('user_id')?.id,
                    username: appointment.get('user_id')?.get('username'),
                    fullName: appointment.get('user_id')?.get('fullName'),
                    mobileNumber: appointment
                      .get('user_id')
                      ?.get('mobileNumber'),
                  },
                  provider_id: {
                    id: appointment.get('provider_id')?.id,
                    username: appointment.get('provider_id')?.get('username'),
                    fullName: appointment.get('provider_id')?.get('fullName'),
                  },
                }
              : null,
            child: child
              ? {
                  objectId: child.id,
                  fullName: child.get('fullName'),
                }
              : (() => {
                  console.log(`ChatGroup ${group.id}: child_id is null`);
                  return null;
                })(),
          };
        })
      );

      const communityQuery = new Parse.Query(ChatGroup);
      communityQuery.equalTo('chat_type', 'community');
      communityQuery.equalTo('chat_status', 'active');
      const communityGroups = await communityQuery.find({useMasterKey: true});

      const allChatGroups = [
        ...privateGroups.filter(Boolean),
        ...communityGroups.map(g => ({
          objectId: g.id,
          chat_type: 'community',
          community_name: g.get('community_name'),
          chat_status: 'active',
        })),
      ];

      return {
        count: allChatGroups.length,
        chat_groups: allChatGroups,
      };
    } catch (error: any) {
      console.error('Error in getMyChatGroups:', error);
      throw {
        codeStatus: error.codeStatus || 1014,
        message: error.message || 'Failed to fetch chat groups',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_group_id: {type: String, required: true},
      },
    },
  })
  async getChatParticipants(req: Parse.Cloud.FunctionRequest) {
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
      query.include('user_id');
      query.limit(20);

      const results = await query.find({useMasterKey: true});

      const participants = results.map(item => {
        const participant = item.get('user_id');
        return {
          objectId: participant.id,
          username: participant.get('username'),
          email: participant.get('email'),
          fcm_token: participant.get('fcm_token'),
          createdAt: participant.get('createdAt'),
        };
      });

      return {
        count: participants.length,
        participants,
      };
    } catch (error: any) {
      console.error('Error in getChatParticipants:', error);
      throw {
        codeStatus: error.codeStatus || 1015,
        message: error.message || 'Failed to fetch chat participants',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_group_id: {type: String, required: true},
      },
    },
  })
  async archiveChatGroup(req: Parse.Cloud.FunctionRequest) {
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
            'Unauthorized: You must be Admin or SuperAdmin to archive chat groups',
        };
      }

      const {chat_group_id} = req.params;

      const chatGroup = await new Parse.Query(ChatGroup).get(chat_group_id, {
        useMasterKey: true,
      });

      if (!chatGroup) {
        throw {
          codeStatus: 404,
          message: 'Chat group not found',
        };
      }

      chatGroup.set('chat_status', 'archived');
      await chatGroup.save(null, {useMasterKey: true});

      return {
        message: 'Chat group archived successfully',
        chat_group_id,
      };
    } catch (error: any) {
      console.error('Error in archiveChatGroup:', error);
      throw {
        codeStatus: error.codeStatus || 1023,
        message: error.message || 'Failed to archive chat group',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        name: {type: String, required: true},
      },
    },
  })
  async createCommunityChatGroup(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) throw {codeStatus: 103, message: 'User context is missing'};

      const {name} = req.params;

      const existing = await new Parse.Query(ChatGroup)
        .equalTo('chat_type', 'community')
        .equalTo('community_name', name)
        .first({useMasterKey: true});

      if (existing) {
        return {
          message: 'Community chat already exists',
          chat_group_id: existing.id,
        };
      }

      const chatGroup = new ChatGroup();
      chatGroup.set('chat_type', 'community');
      chatGroup.set('community_name', name);
      chatGroup.set('chat_status', 'active');
      await chatGroup.save(null, {useMasterKey: true});

      return {
        message: 'Community chat group created successfully',
        chat_group_id: chatGroup.id,
      };
    } catch (error: any) {
      console.error('Error in createCommunityChatGroup:', error);
      throw {
        codeStatus: error.codeStatus || 1028,
        message: error.message || 'Failed to create community chat group',
      };
    }
  }
}

export default new ChatGroupFunctions();
