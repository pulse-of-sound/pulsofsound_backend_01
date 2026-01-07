import User from '../../models/User';
import {CloudFunction} from '../../utils/Registry/decorators';
import {UserRoles} from '../../utils/constants';
class UserManagement_ {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        id: {required: false, type: String},
        email: {required: false, type: String},
        username: {required: false, type: String},
        password: {required: false, type: String},
        firstName: {required: false, type: String},
        lastName: {required: false, type: String},
        profilePic: {required: false, type: Object},
        whatsApp: {required: false, type: String},
        BRN: {required: false, type: String},
        licenseIssueDate: {required: false, type: String},
        licenseExpiryDate: {required: false, type: String},
        mobile: {required: false, type: String},
        propertiesCount: {required: false, type: Number},
        emirates: {required: false, type: Object},
        role: {required: false, type: Object},
        relatedAGENCY: {required: false, type: Object},
        website: {required: false, type: String},
        ORN: {required: false, type: Number},
        brokersCount: {required: false, type: Number},
        status: {required: false, type: Boolean, default: true},
        staffProfileId: {required: false, type: String},
      },
      requireAnyUserRoles: [UserRoles.SUPER_ADMIN, UserRoles.SUPER_ADMIN],
    },
  })
  async addEditSystemUser(req: Parse.Cloud.FunctionRequest) {
    const {
      id,
      email,
      username,
      password,
      firstName,
      lastName,
      profilePic,
      whatsApp,
      BRN,
      licenseIssueDate,
      licenseExpiryDate,
      propertiesCount,
      role,
      mobile,
      status,
      emirates,
      relatedAGENCY,
      website,
      ORN,
      brokersCount,
    } = req.params;

    const sessionToken = req.user?.getSessionToken();
    const {user} = await User.createUserRecord({
      id,
      email,
      username,
      password,
      status,
    });

    await user.save(null, {useMasterKey: true});

    const assignedRole = await User.assignRoleToUser(user, role?.id);

    return User.map(user, assignedRole);
  }

  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: true,
      fields: {},
      requireAnyUserRoles: [UserRoles.SUPER_ADMIN, UserRoles.SUPER_ADMIN],
    },
  })
  async getCustomRoles(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = req.user?.getSessionToken();
    const roleQuery = new Parse.Query(Parse.Role);

    roleQuery.equalTo('isCustom', true);
    const roles = await roleQuery.find({sessionToken});

    const filteredRoles = roles.filter(role => {
      const roleName = role.get('name');
      return roleName !== 'SuperAdmin' && roleName !== 'Public';
    });

    return filteredRoles.map(role => ({
      id: role.id,
      name: role.get('name'),
    }));
  }

  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: true,
    },
  })
  async getUserRole(req: Parse.Cloud.FunctionRequest) {
    const user = req.user;

    const sessionToken = user?.getSessionToken();

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('users', user);
    const roles = await roleQuery.find({useMasterKey: true});
    const validRoleNames = Object.values(UserRoles);

    const matchedRoles = roles
      .filter(role => validRoleNames.includes(role.get('name')))
      .map(role => ({
        id: role.id,
        name: role.get('name'),
      }));

    return matchedRoles;
  }
}
