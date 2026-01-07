import User from '../../models/User';

import {implementACL} from '../../utils/ACL';
import {UserRoles} from '../../utils/constants';

Parse.Cloud.afterSave(User, async req => {
  const obj = req.object;
  const user = req.user!;

  if (!obj.existed()) {
    obj.setACL(
      implementACL({
        roleRules: [
          {role: UserRoles.SUPER_ADMIN, read: true, write: true},
          {role: UserRoles.SUPER_ADMIN, read: true, write: true},
        ],
        owner: {user: obj.id, read: true, write: true},
      })
    );
  }
});
Parse.Cloud.beforeSave('StaffProfile', async request => {
  const staffProfile = request.object;

  if (!staffProfile.getACL()) {
    const acl = new Parse.ACL();

    const user = request.user;
    if (user) {
      acl.setReadAccess(user.id, true);
      acl.setWriteAccess(user.id, true);
    }

    acl.setRoleWriteAccess('Admin', true);
    acl.setRoleReadAccess('Admin', true);

    staffProfile.setACL(acl);
  }
});
