import {CloudFunction} from '../../utils/Registry/decorators';
import ChatMessage from '../../models/ChatMessage';
import ChatGroup from '../../models/ChatGroup';
import ChatGroupParticipant from '../../models/ChatGroupParticipant';

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

class ChatMessageFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_group_id: {type: String, required: true},
        message: {type: String, required: true},
        child_id: {type: String, required: false},
      },
    },
  })
  async sendChatMessage(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_group_id, message, child_id} = req.params;

      const chatGroup = await new Parse.Query(ChatGroup)
        .include([
          'appointment_id',
          'appointment_id.user_id',
          'appointment_id.provider_id',
        ])
        .get(chat_group_id, {useMasterKey: true});

      if (!chatGroup) {
        throw {codeStatus: 104, message: 'Chat group not found'};
      }

      const isCommunity = chatGroup.get('chat_type') === 'community';
      const appointment = chatGroup.get('appointment_id');
      const senderId = user.id;

      let receiverId: string | null = null;
      if (!isCommunity && appointment) {
        const userA = appointment.get('user_id')?.id;
        const userB = appointment.get('provider_id')?.id;
        receiverId = senderId === userA ? userB : userA;
      }

      const chatMessage = new ChatMessage();
      chatMessage.set('chat_group_id', chatGroup);
      chatMessage.set('send_id', user);
      if (receiverId) {
        chatMessage.set(
          'receive_id',
          new Parse.Object('_User', {id: receiverId})
        );
      }
      chatMessage.set('message', message);
      chatMessage.set('time', new Date());

      const finalChildId = child_id || chatGroup.get('child_id')?.id;
      if (finalChildId) {
        chatMessage.set(
          'child_id',
          new Parse.Object('ChildProfile', {id: finalChildId})
        );
      }
      const chatStatus = chatGroup.get('chat_status');
      if (chatStatus === 'archived') {
        throw {
          codeStatus: 403,
          message: 'This chat group is archived. You cannot send new messages.',
        };
      }

      if (!isCommunity && appointment) {
        const plan = await appointment
          .get('appointment_plan_id')
          ?.fetch({useMasterKey: true});
        if (plan) {
          const durationMinutes = plan.get('duration_minutes');
          if (durationMinutes) {
            const startTime = chatGroup.createdAt.getTime();
            const currentTime = new Date().getTime();
            const elapsedMinutes = (currentTime - startTime) / (1000 * 60);

            if (elapsedMinutes > durationMinutes) {
              chatGroup.set('chat_status', 'archived');
              await chatGroup.save(null, {useMasterKey: true});
              throw {
                codeStatus: 403,
                message: 'This chat session has expired and is now archived.',
              };
            }
          }
        }
      }
      if (!isCommunity) {
        const participantQuery = new Parse.Query(ChatGroupParticipant);
        participantQuery.equalTo(
          'chat_group_id',
          new Parse.Object('ChatGroup', {id: chat_group_id})
        );
        participantQuery.equalTo('user_id', user);

        const participant = await participantQuery.first({useMasterKey: true});
        if (!participant) {
          throw {
            codeStatus: 105,
            message: 'You are not a participant in this group',
          };
        }

        const isMuted = participant.get('is_muted');
        const muteUntil = participant.get('mute_until');

        if (isMuted && muteUntil && muteUntil > new Date()) {
          throw {
            codeStatus: 403,
            message: `You are muted until ${muteUntil.toISOString()}`,
          };
        }
      }

      if (receiverId) {
        const notification = new Parse.Object('Notifications');
        notification.set(
          'user_id',
          new Parse.Object('_User', {id: receiverId})
        );
        notification.set('title', 'رسالة جديدة');
        notification.set('body', `لديك رسالة جديدة من ${user.get('username')}`);
        notification.set('image', null);
        await notification.save(null, {useMasterKey: true});
        chatMessage.set('notifications_id', notification);
      }

      await chatMessage.save(null, {useMasterKey: true});

      chatGroup.set('last_message', message);
      await chatGroup.save(null, {useMasterKey: true});

      return {
        message: 'Message sent successfully',
        chat_message_id: chatMessage.id,
      };
    } catch (error: any) {
      console.error('Error in sendChatMessage:', error);
      throw {
        codeStatus: error.codeStatus || 1016,
        message: error.message || 'Failed to send chat message',
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
  async getChatMessages(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_group_id} = req.params;
      if (!chat_group_id) {
        throw {codeStatus: 104, message: 'chat_group_id is required'};
      }

      const query = new Parse.Query(ChatMessage);
      query.equalTo(
        'chat_group_id',
        new Parse.Object('ChatGroup', {id: chat_group_id})
      );
      query.include([
        'send_id',
        'receive_id',
        'child_id',
        'chat_group_id',
        'chat_group_id.child_id',
      ]);
      query.ascending('time');
      query.limit(100);

      const results = await query.find({useMasterKey: true});

      let durationMinutes = 30;
      let remainingSeconds = 1800;
      let chatStatus = 'active';

      try {
        const group = await new Parse.Query(ChatGroup)
          .include(['appointment_id', 'appointment_id.appointment_plan_id'])
          .get(chat_group_id, {useMasterKey: true});

        if (group) {
          chatStatus = group.get('chat_status') || 'active';
          if (group.get('chat_type') === 'private') {
            const appointment = group.get('appointment_id');
            const plan = appointment?.get('appointment_plan_id');
            if (plan) {
              durationMinutes = plan.get('duration_minutes') || 30;
              const startTime = group.createdAt.getTime();
              const currentTime = new Date().getTime();
              const elapsedSeconds = Math.floor(
                (currentTime - startTime) / 1000
              );
              remainingSeconds = Math.max(
                0,
                durationMinutes * 60 - elapsedSeconds
              );

              if (remainingSeconds <= 0 && chatStatus === 'active') {
                group.set('chat_status', 'archived');
                await group.save(null, {useMasterKey: true});
                chatStatus = 'archived';
              }
            }
          }
        }
      } catch (e) {
        console.log('ChatGroup fetch failed/skipped in getChatMessages:', e);
      }

      const messages = results.map(msg => {
        const childObj =
          msg.get('child_id') || msg.get('chat_group_id')?.get('child_id');

        return {
          objectId: msg.id,
          message: msg.get('message'),
          time: msg.get('time'),
          send_id: {
            id: msg.get('send_id')?.id,
            username: msg.get('send_id')?.get('username'),
            fullName: msg.get('send_id')?.get('fullName'),
            mobileNumber: msg.get('send_id')?.get('mobileNumber'),
          },
          receive_id: {
            id: msg.get('receive_id')?.id,
            username: msg.get('receive_id')?.get('username'),
            fullName: msg.get('receive_id')?.get('fullName'),
            mobileNumber: msg.get('receive_id')?.get('mobileNumber'),
          },
          child_id: {
            id: childObj?.id || null,
            fullName: childObj?.get('fullName') || null,
          },
        };
      });

      return {
        count: messages.length,
        messages,
        duration_minutes: durationMinutes,
        remaining_seconds: remainingSeconds,
        chat_status: chatStatus,
      };
    } catch (error: any) {
      console.error('Error in getChatMessages:', error);
      throw {
        codeStatus: error.codeStatus || 1017,
        message: error.message || 'Failed to fetch chat messages',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_message_id: {type: String, required: true},
      },
    },
  })
  async markMessageAsRead(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_message_id} = req.params;

      const message = await new Parse.Query(ChatMessage)
        .include(['receive_id'])
        .get(chat_message_id, {useMasterKey: true});

      if (!message) {
        throw {codeStatus: 104, message: 'Message not found'};
      }

      const receiver = message.get('receive_id');
      if (!receiver || receiver.id !== user.id) {
        throw {
          codeStatus: 102,
          message: 'Unauthorized: You are not the receiver of this message',
        };
      }

      message.set('is_read', true);
      message.set('read_at', new Date());
      await message.save(null, {useMasterKey: true});

      return {
        message: 'Message marked as read',
        chat_message_id: message.id,
        read_at: message.get('read_at'),
      };
    } catch (error: any) {
      console.error('Error in markMessageAsRead:', error);
      throw {
        codeStatus: error.codeStatus || 1018,
        message: error.message || 'Failed to mark message as read',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getUserChatGroups(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const query = new Parse.Query(ChatGroup);
      query.include([
        'appointment_id',
        'appointment_id.user_id',
        'appointment_id.provider_id',
      ]);
      query.limit(100);
      query.descending('updatedAt');

      const appointmentQueryA = new Parse.Query('Appointment').equalTo(
        'user_id',
        user
      );
      const appointmentQueryB = new Parse.Query('Appointment').equalTo(
        'provider_id',
        user
      );
      const combinedAppointmentQuery = Parse.Query.or(
        appointmentQueryA,
        appointmentQueryB
      );

      query.matchesQuery('appointment_id', combinedAppointmentQuery);

      const results = await query.find({useMasterKey: true});

      const groups = await Promise.all(
        results.map(async group => {
          const appointment = group.get('appointment_id');
          const plan = await appointment
            ?.get('appointment_plan_id')
            ?.fetch({useMasterKey: true});

          let status = group.get('chat_status');
          if (status === 'active' && plan) {
            const durationMinutes = plan.get('duration_minutes');
            if (durationMinutes) {
              const startTime = group.createdAt.getTime();
              const currentTime = new Date().getTime();
              const elapsedMinutes = (currentTime - startTime) / (1000 * 60);

              if (elapsedMinutes > durationMinutes) {
                group.set('chat_status', 'archived');
                await group.save(null, {useMasterKey: true});
                status = 'archived';
              }
            }
          }

          return {
            objectId: group.id,
            last_message: group.get('last_message') || null,
            chat_status: status,
            updatedAt: group.updatedAt,
            appointment: {
              objectId: appointment?.id,
              user_id: {
                id: appointment?.get('user_id')?.id,
                username: appointment?.get('user_id')?.get('username'),
                fullName: appointment?.get('user_id')?.get('fullName'),
              },
              provider_id: {
                id: appointment?.get('provider_id')?.id,
                username: appointment?.get('provider_id')?.get('username'),
                fullName: appointment?.get('provider_id')?.get('fullName'),
              },
            },
          };
        })
      );

      return {
        count: groups.length,
        chat_groups: groups,
      };
    } catch (error: any) {
      console.error('Error in getUserChatGroups:', error);
      throw {
        codeStatus: error.codeStatus || 1019,
        message: error.message || 'Failed to fetch user chat groups',
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
  async getChatHistory(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_group_id} = req.params;

      const query = new Parse.Query(ChatMessage);
      query.equalTo(
        'chat_group_id',
        new Parse.Object('ChatGroup', {id: chat_group_id})
      );
      query.include(['send_id', 'receive_id', 'child_id']);
      query.ascending('time');
      query.limit(1000);
      const messages = await query.find({useMasterKey: true});

      const formatted = messages.map(msg => ({
        chat_message_id: msg.id,
        message: msg.get('message'),
        time: msg.get('time'),
        sender: {
          id: msg.get('send_id')?.id,
          username: msg.get('send_id')?.get('username'),
        },
        receiver: {
          id: msg.get('receive_id')?.id,
          username: msg.get('receive_id')?.get('username'),
        },
        child_id: msg.get('child_id')?.id || null,
      }));

      return {
        message: 'Chat history retrieved successfully',
        chat_group_id,
        messages: formatted,
      };
    } catch (error: any) {
      console.error('Error in getChatHistory:', error);
      throw {
        codeStatus: error.codeStatus || 1024,
        message: error.message || 'Failed to retrieve chat history',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        chat_message_id: {type: String, required: true},
      },
    },
  })
  async deleteChatMessage(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {chat_message_id} = req.params;

      const message = await new Parse.Query(ChatMessage)
        .include(['send_id'])
        .get(chat_message_id, {useMasterKey: true});

      if (!message) {
        throw {codeStatus: 104, message: 'Message not found'};
      }

      const role = user.get('role')?.get('name');
      const isAdmin = role === 'SuperAdmin' || role === 'Admin';
      const isSender = message.get('send_id')?.id === user.id;

      if (!isAdmin && !isSender) {
        throw {codeStatus: 102, message: 'Unauthorized to delete this message'};
      }

      await message.destroy({useMasterKey: true});

      return {message: 'Message deleted successfully'};
    } catch (error: any) {
      console.error('Error in deleteChatMessage:', error);
      throw {
        codeStatus: error.codeStatus || 1029,
        message: error.message || 'Failed to delete chat message',
      };
    }
  }
}

export default new ChatMessageFunctions();
