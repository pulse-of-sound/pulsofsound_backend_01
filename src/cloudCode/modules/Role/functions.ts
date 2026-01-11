import Role from '../../models/Role';
import {CloudFunction} from '../../utils/Registry/decorators';

class RoleFunctions {
//إنشاء دور
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        name: {required: true, type: String},
      },
    },
  })
  async createRole(req: Parse.Cloud.FunctionRequest) {
    const {name} = req.params;

    const user = req.user;
    if (!user || !(user instanceof Parse.User)) {
      throw new Error('Invalid user context for ACL');
    }

    const role = new Role();
    role.set('name', name);
    role.set('isCustom', true);

    const acl = new Parse.ACL(user);
    acl.setPublicReadAccess(true);
    acl.setWriteAccess(user.id, true);
    role.setACL(acl);

    await role.save(null, {useMasterKey: true});
    return `Role '${name}' created successfully`;
  }
}

export default new RoleFunctions();
