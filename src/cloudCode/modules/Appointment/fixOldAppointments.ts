Parse.Cloud.define(
  'fixOldAppointmentsChildId',
  async (req: Parse.Cloud.FunctionRequest) => {
    const user = req.user;
    if (!user) {
      throw new Error('Authentication required');
    }

    const role = await user.get('role')?.fetch({useMasterKey: true});
    if (!role || !['Admin', 'SuperAdmin'].includes(role.get('name'))) {
      throw new Error('Only admins can run this script');
    }

    const Appointment = Parse.Object.extend('Appointment');
    const ChatGroup = Parse.Object.extend('ChatGroup');

    const appointmentQuery = new Parse.Query(Appointment);
    appointmentQuery.doesNotExist('child_id');
    appointmentQuery.limit(1000);

    const appointments = await appointmentQuery.find({useMasterKey: true});
    console.log(`Found ${appointments.length} appointments without child_id`);

    let updated = 0;
    let failed = 0;

    for (const appointment of appointments) {
      try {
        const chatGroupQuery = new Parse.Query(ChatGroup);
        chatGroupQuery.equalTo('appointment_id', appointment);
        chatGroupQuery.include('child_id');
        const chatGroup = await chatGroupQuery.first({useMasterKey: true});

        if (chatGroup) {
          const childId = chatGroup.get('child_id');
          if (childId) {
            appointment.set('child_id', childId);
            await appointment.save(null, {useMasterKey: true});
            updated++;
            console.log(
              ` Updated appointment ${appointment.id} with child ${childId.id}`
            );
          } else {
            failed++;
            console.log(
              ` ChatGroup for appointment ${appointment.id} has no child_id`
            );
          }
        } else {
          failed++;
          console.log(`No ChatGroup found for appointment ${appointment.id}`);
        }
      } catch (error) {
        failed++;
        console.error(
          ` Error processing appointment ${appointment.id}:`,
          error
        );
      }
    }

    return {
      message: 'Fix completed',
      total: appointments.length,
      updated,
      failed,
    };
  },
  {
    requireUser: true,
    fields: {},
  }
);
