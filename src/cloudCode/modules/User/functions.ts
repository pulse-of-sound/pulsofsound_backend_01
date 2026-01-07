import User from '../../models/User';
import {CloudFunction} from '../../utils/Registry/decorators';
import {catchError} from '../../utils/catchError';
import {UserRoles} from '../../utils/constants';
import {generateRandomString} from '../../utils/generateRandom';
import {SystemRoles} from '../../utils/rols';

class User_ {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        fullName: {required: false, type: String},
        username: {required: false, type: String},
        fcm_token: {required: false, type: String},
        birthDate: {required: false, type: String},
        fatherName: {required: false, type: String},
        gender: {required: false, type: String},
        mobileNumber: {required: false, type: String},
        specialty: {required: false, type: String},
        medical_info: {required: false, type: String},
        profilePic: {required: false, type: Object},
      },
    },
  })
  async updateMyAccount(req: Parse.Cloud.FunctionRequest) {
    let user = req.user as User;
    const body = req.params;

    if (!user) {
      const sessionToken = (req as any).headers[
        'x-parse-session-token'
      ] as string;

      if (!sessionToken) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found');
      }

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      const session = await sessionQuery.first({useMasterKey: true});

      if (!session) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Invalid session');
      }

      user = session.get('user');
      if (!user) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found');
      }
    }

    console.log('--- updateMyAccount Start ---');
    console.log('Body params:', JSON.stringify(body));
    console.log('User id:', user.id);

    if (body.fullName !== undefined) user.set('fullName', body.fullName);
    if (body.username !== undefined) user.set('username', body.username);
    if (body.fcm_token !== undefined) user.set('fcm_token', body.fcm_token);

    if (body.birthDate !== undefined && body.birthDate !== null) {
      try {
        let dateObj: Date;
        if (
          typeof body.birthDate === 'string' &&
          body.birthDate.includes('/')
        ) {
          const [day, month, year] = body.birthDate.split('/').map(Number);
          dateObj = new Date(year, month - 1, day);
        } else {
          dateObj = new Date(body.birthDate);
        }

        if (!isNaN(dateObj.getTime())) {
          dateObj.setHours(12, 0, 0, 0);
          user.set('birthDate', dateObj);
          console.log('birthDate set to:', dateObj.toISOString());
        } else {
          console.warn('Invalid birthDate received:', body.birthDate);
        }
      } catch (e) {
        console.warn('Error parsing birthDate:', e);
      }
    }

    if (body.fatherName !== undefined) user.set('fatherName', body.fatherName);
    if (body.gender !== undefined) user.set('gender', body.gender);
    if (body.mobileNumber !== undefined) {
      user.set('mobileNumber', body.mobileNumber);
      user.set('mobile', body.mobileNumber);
    }
    if (body.specialty !== undefined) user.set('specialty', body.specialty);
    if (body.medical_info !== undefined)
      user.set('medical_info', body.medical_info);

    if (body.profilePic !== undefined) {
      console.log('Updating profilePic with:', JSON.stringify(body.profilePic));
      if (body.profilePic && body.profilePic.__type === 'File') {
        // @ts-ignore
        const parseFile = Parse.File.fromJSON(body.profilePic);
        user.set('profilePic', parseFile);
        console.log('profilePic set successfully. New URL:', parseFile.url());
      } else if (body.profilePic === null) {
        user.unset('profilePic');
        console.log('profilePic unset');
      }
    }

    console.log('Preparing to save user with fields:', {
      fullName: user.get('fullName'),
      fatherName: user.get('fatherName'),
      gender: user.get('gender'),
      medical_info: user.get('medical_info'),
      birthDate: user.get('birthDate'),
      profilePic: user.get('profilePic')
        ? user.get('profilePic').url()
        : 'null',
    });

    const savedUser = await user.save(null, {useMasterKey: true});
    console.log('User saved successfully. id:', savedUser.id);
    console.log('--- updateMyAccount End ---');

    // جلب الرول لإرجاع كائن كامل
    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('users', savedUser);
    const role = await roleQuery.first({useMasterKey: true});

    return User.map(savedUser, role);
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getMyProfile(req: Parse.Cloud.FunctionRequest) {
    let user = req.user as User;

    if (!user) {
      const sessionToken = (req as any).headers[
        'x-parse-session-token'
      ] as string;

      if (!sessionToken) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found');
      }

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});

      if (!session) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Invalid session');
      }

      user = session.get('user');
      if (!user) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found');
      }
    }

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('users', user);
    const roles = await roleQuery.find({useMasterKey: true});

    const validRoleNames = Object.values(UserRoles);
    const matchedRoles = roles.filter(role =>
      validRoleNames.includes(role.get('name'))
    );

    const userRole = matchedRoles[0];
    const userJson = User.map(user, userRole) as any;
    const sessionToken =
      req.user?.getSessionToken() ||
      ((req as any).headers['x-parse-session-token'] as string);
    userJson.sessionToken = sessionToken;

    return userJson;
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async logout(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = req.user?.getSessionToken();
    if (!sessionToken) return {message: 'User is already logged out'};

    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    const session = await sessionQuery.first({useMasterKey: true});

    if (!session) throw new Error('Session not found');

    await session.destroy({useMasterKey: true});
    return {message: 'User logged out successfully'};
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        username: {
          required: true,
          type: String,
        },
        password: {
          required: true,
          type: String,
        },
      },
    },
  })
  async loginUser(req: Parse.Cloud.FunctionRequest) {
    const {username, password} = req.params;
    console.log('ssssssssssssssssssssssss');

    const [error, user] = await catchError<Parse.User>(
      User.logIn(username, password, {
        installationId: generateRandomString(10),
      })
    );

    if (error) {
      throw new Parse.Error(Parse.Error.OTHER_CAUSE, error?.message);
    }
    console.log(user);
    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('users', user);

    const roles = await roleQuery.find({useMasterKey: true});

    const validRoleNames = Object.values(UserRoles);
    const matchedRoles = roles.filter(role =>
      validRoleNames.includes(role.get('name'))
    );

    const selectedRole = matchedRoles[0];
    const userJson = User.map(user as User, selectedRole) as any;

    return {
      ...userJson,
      sessionToken: user.getSessionToken(),
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        mobileNumber: {
          required: true,
          type: String,
        },
        OTP: {
          required: true,
          type: String,
        },
      },
    },
  })
  async loginWithMobile(req: Parse.Cloud.FunctionRequest) {
    const {mobileNumber, OTP} = req.params;

    let user: any, error: any, clientRole;

    [error, user] = await catchError<any>(
      Parse.User.logInWith(
        'mobileAuth',
        {
          authData: {
            id: mobileNumber,
            OTP: OTP,
          },
        },
        {installationId: mobileNumber, useMasterKey: true}
      )
    );
    if (error) {
      throw new Parse.Error(Parse.Error.OTHER_CAUSE, error?.message);
    }

    const sessionToken = user.getSessionToken();
    user.set('mobileNumber', mobileNumber);
    user.set('mobile', mobileNumber);
    const childRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.CHILD)
      .first({useMasterKey: true});

    if (!childRole) {
      throw new Parse.Error(141, `Role '${SystemRoles.CHILD}' not found`);
    }

    user.set('role', childRole.toPointer());

    clientRole = await User.assignRoleToUser(user, SystemRoles.CHILD);

    await user.save(null, {useMasterKey: true});
    await user.fetchWithInclude([], {useMasterKey: true});
    const userJson = User.map(user, clientRole) as any;
    userJson.sessionToken = sessionToken;

    return userJson;
  }

  ////////////////////////////////////////////////////

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        role: {required: false, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addSystemUser(req: Parse.Cloud.FunctionRequest) {
    const {fullName, username, password, mobile, email} = req.params;
    const role = req.params.role || SystemRoles.CHILD;

    const validRoles = Object.values(SystemRoles);
    if (!validRoles.includes(role)) {
      throw new Parse.Error(141, `Invalid role provided: ${role}`);
    }

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', role);
    const roleObj = await roleQuery.first({useMasterKey: true});

    if (!roleObj) {
      throw new Parse.Error(141, `Role '${role}' not found in _Role table`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      if (existingUser) {
        passwordQuery.notEqualTo('objectId', existingUser.id);
      }
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    if (existingUser) {
      existingUser.set('fullName', fullName);
      if (password && password !== '********' && password !== 'temp123') {
        existingUser.set('password', password);
        existingUser.set('passwordDisplay', password);
      }
      existingUser.set('role', roleObj.toPointer());
      if (mobile) {
        existingUser.set('mobile', mobile);
        existingUser.set('mobileNumber', mobile);
      }
      if (email) existingUser.set('email', email);

      await existingUser.save(null, {useMasterKey: true});

      roleObj.relation('users').add(existingUser);
      await roleObj.save(null, {useMasterKey: true});

      return {
        message: `${role} updated successfully`,
        userId: existingUser.id,
        username,
        role,
      };
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', roleObj.toPointer());
    if (mobile) {
      user.set('mobile', mobile);
      user.set('mobileNumber', mobile);
    }
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    roleObj.relation('users').add(user);
    await roleObj.save(null, {useMasterKey: true});

    return {
      message: `${role} created and logged in successfully`,
      sessionToken: user.getSessionToken(),
      userId: user.id,
      username,
      role,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addEditDoctor(req: Parse.Cloud.FunctionRequest) {
    const {fullName, username, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.DOCTOR);
    const roleObj = await roleQuery.first({useMasterKey: true});

    if (!roleObj) {
      throw new Parse.Error(141, `Role '${SystemRoles.DOCTOR}' not found`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      if (existingUser) {
        passwordQuery.notEqualTo('objectId', existingUser.id);
      }
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    if (existingUser) {
      existingUser.set('fullName', fullName);
      if (password && password !== '********' && password !== 'temp123') {
        existingUser.set('password', password);
        existingUser.set('passwordDisplay', password);
      }
      if (mobile) {
        existingUser.set('mobile', mobile);
        existingUser.set('mobileNumber', mobile);
      }
      if (email) existingUser.set('email', email);
      existingUser.set('role', roleObj.toPointer());

      await existingUser.save(null, {useMasterKey: true});

      roleObj.relation('users').add(existingUser);
      await roleObj.save(null, {useMasterKey: true});

      return {
        message: 'Doctor updated successfully',
        userId: existingUser.id,
        username,
        role: SystemRoles.DOCTOR,
      };
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', roleObj.toPointer());
    if (mobile) {
      user.set('mobile', mobile);
      user.set('mobileNumber', mobile);
    }
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    roleObj.relation('users').add(user);
    await roleObj.save(null, {useMasterKey: true});

    return {
      message: 'Doctor created and logged in successfully',
      sessionToken: user.getSessionToken(),
      userId: user.id,
      username,
      role: SystemRoles.DOCTOR,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addEditSpecialist(req: Parse.Cloud.FunctionRequest) {
    const {fullName, username, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.SPECIALIST);
    const roleObj = await roleQuery.first({useMasterKey: true});

    if (!roleObj) {
      throw new Parse.Error(141, `Role '${SystemRoles.SPECIALIST}' not found`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      if (existingUser) {
        passwordQuery.notEqualTo('objectId', existingUser.id);
      }
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    if (existingUser) {
      existingUser.set('fullName', fullName);
      if (password && password !== '********' && password !== 'temp123') {
        existingUser.set('password', password);
        existingUser.set('passwordDisplay', password);
      }
      if (mobile) {
        existingUser.set('mobile', mobile);
        existingUser.set('mobileNumber', mobile);
      }
      if (email) existingUser.set('email', email);
      existingUser.set('role', roleObj.toPointer());

      await existingUser.save(null, {useMasterKey: true});

      roleObj.relation('users').add(existingUser);
      await roleObj.save(null, {useMasterKey: true});

      return {
        message: 'Specialist updated successfully',
        userId: existingUser.id,
        username,
        role: SystemRoles.SPECIALIST,
      };
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', roleObj.toPointer());
    if (mobile) {
      user.set('mobile', mobile);
      user.set('mobileNumber', mobile);
    }
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    roleObj.relation('users').add(user);
    await roleObj.save(null, {useMasterKey: true});

    return {
      message: 'Specialist created and logged in successfully',
      sessionToken: user.getSessionToken(),
      userId: user.id,
      username,
      role: SystemRoles.SPECIALIST,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addEditAdmin(req: Parse.Cloud.FunctionRequest) {
    const {fullName, username, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.ADMIN);
    const roleObj = await roleQuery.first({useMasterKey: true});

    if (!roleObj) {
      throw new Parse.Error(141, `Role '${SystemRoles.ADMIN}' not found`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      if (existingUser) {
        passwordQuery.notEqualTo('objectId', existingUser.id);
      }
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    if (existingUser) {
      existingUser.set('fullName', fullName);
      if (password && password !== '********' && password !== 'temp123') {
        existingUser.set('password', password);
        existingUser.set('passwordDisplay', password);
      }
      if (mobile) {
        existingUser.set('mobile', mobile);
        existingUser.set('mobileNumber', mobile);
      }
      if (email) existingUser.set('email', email);
      existingUser.set('role', roleObj.toPointer());

      await existingUser.save(null, {useMasterKey: true});

      roleObj.relation('users').add(existingUser);
      await roleObj.save(null, {useMasterKey: true});

      return {
        message: 'Admin updated successfully',
        userId: existingUser.id,
        username,
        role: SystemRoles.ADMIN,
      };
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', roleObj.toPointer());
    if (mobile) {
      user.set('mobile', mobile);
      user.set('mobileNumber', mobile);
    }
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    roleObj.relation('users').add(user);
    await roleObj.save(null, {useMasterKey: true});

    return {
      message: 'Admin created and logged in successfully',
      sessionToken: user.getSessionToken(),
      userId: user.id,
      username,
      role: SystemRoles.ADMIN,
    };
  }

  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: false,
    },
  })
  async getAllDoctors(req: Parse.Cloud.FunctionRequest) {
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

    const currentUser = session.get('user');

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');

    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'Access denied. Only Admin and Super Admin can view doctors.'
      );
    }

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.DOCTOR);
    const roleObj = await roleQuery.first({useMasterKey: true});

    if (!roleObj) {
      throw new Parse.Error(141, `Role '${SystemRoles.DOCTOR}' not found`);
    }

    const usersQuery = new Parse.Query(Parse.User);
    usersQuery.equalTo('role', roleObj.toPointer());
    usersQuery.include('role');
    usersQuery.limit(1000);
    const doctors = await usersQuery.find({useMasterKey: true});

    const result = doctors.map(user => ({
      id: user.id,
      fullName: user.get('fullName'),
      username: user.get('username'),
      email: user.get('email'),
      mobile: user.get('mobile'),
      role: user.get('role')?.get('name'),
    }));

    return result;
  }

  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: false,
    },
  })
  async getAllSpecialists(req: Parse.Cloud.FunctionRequest) {
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

    const currentUser = session.get('user');

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');

    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }

    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');

    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'Access denied. Only Admin and Super Admin can view specialists.'
      );
    }

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.SPECIALIST);
    const roleObj = await roleQuery.first({useMasterKey: true});

    if (!roleObj) {
      throw new Parse.Error(141, `Role '${SystemRoles.SPECIALIST}' not found`);
    }

    const usersQuery = new Parse.Query(Parse.User);
    usersQuery.equalTo('role', roleObj.toPointer());
    usersQuery.include('role');
    usersQuery.limit(1000);
    const specialists = await usersQuery.find({useMasterKey: true});

    const result = specialists.map(user => ({
      id: user.id,
      fullName: user.get('fullName'),
      username: user.get('username'),
      email: user.get('email'),
      mobile: user.get('mobile') || user.get('mobileNumber'),
      mobileNumber: user.get('mobileNumber') || user.get('mobile'),
      role: user.get('role')?.get('name'),
    }));

    return result;
  }
  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: false,
    },
  })
  async getAllAdmins(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];

    console.log('🔍 getAllAdmins - sessionToken:', sessionToken);

    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }

    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});

    console.log('🔍 getAllAdmins - session found:', !!session);
    console.log('🔍 getAllAdmins - session:', session);

    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }

    const currentUser = session.get('user');

    console.log(' getAllAdmins - currentUser:', currentUser);
    console.log(' getAllAdmins - currentUser id:', currentUser?.id);

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');

    console.log('🔍 getAllAdmins - userRole:', userRole);
    console.log('🔍 getAllAdmins - userRole name:', userRole?.get('name'));

    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }

    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');

    console.log('getAllAdmins - roleName:', roleName);
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'Access denied. Only Admin and Super Admin can view admins.'
      );
    }

    const adminRoleQuery = new Parse.Query(Parse.Role);
    adminRoleQuery.equalTo('name', SystemRoles.ADMIN);
    const adminRole = await adminRoleQuery.first({useMasterKey: true});

    if (!adminRole) {
      throw new Parse.Error(141, `Role '${SystemRoles.ADMIN}' not found`);
    }

    const usersQuery = new Parse.Query(Parse.User);
    usersQuery.equalTo('role', adminRole.toPointer());
    usersQuery.include('role');
    usersQuery.limit(1000);
    const admins = await usersQuery.find({useMasterKey: true});

    const result = admins.map(user => ({
      id: user.id,
      fullName: user.get('fullName'),
      username: user.get('username'),
      email: user.get('email'),
      mobile: user.get('mobile') || user.get('mobileNumber'),
      mobileNumber: user.get('mobileNumber') || user.get('mobile'),
      role: user.get('role')?.get('name'),
    }));

    return result;
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async createSystemRolesIfMissing(req: Parse.Cloud.FunctionRequest) {
    const createdRoles: string[] = [];

    for (const roleName of Object.values(SystemRoles)) {
      const query = new Parse.Query(Parse.Role);
      query.equalTo('name', roleName);
      const existing = await query.first({useMasterKey: true});

      if (!existing) {
        const role = new Parse.Role(roleName, new Parse.ACL());
        await role.save(null, {useMasterKey: true});
        createdRoles.push(roleName);
      }
    }

    return {
      message: 'Role seeding complete',
      createdRoles,
    };
  }
  @CloudFunction({
    methods: ['DELETE'],
    validation: {
      requireUser: false,
    },
  })
  async deleteDoctor(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const doctorId = req.params.doctorId;

    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }

    if (!doctorId) {
      throw new Parse.Error(141, 'Doctor ID must be specified.');
    }

    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});

    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }

    const currentUser = session.get('user');

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to delete the doctor.'
      );
    }

    const doctorQuery = new Parse.Query(Parse.User);
    doctorQuery.equalTo('objectId', doctorId);
    const doctor = await doctorQuery.first({useMasterKey: true});

    if (!doctor) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }

    const doctorRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.DOCTOR)
      .first({useMasterKey: true});

    if (!doctorRole) {
      throw new Parse.Error(141, 'Doctor role not found.');
    }

    const userRolePointer = doctor.get('role');
    if (!userRolePointer || userRolePointer.id !== doctorRole.id) {
      throw new Parse.Error(141, 'User is not a doctor.');
    }

    await doctor.destroy({useMasterKey: true});

    return {message: 'The doctor was successfully deleted.'};
  }
  @CloudFunction({
    methods: ['DELETE'],
    validation: {
      requireUser: false,
    },
  })
  async deleteSpecialist(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const specialistId = req.params.specialistId;

    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }

    if (!specialistId) {
      throw new Parse.Error(141, 'Specialist ID must be specified.');
    }

    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});

    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }

    const currentUser = session.get('user');

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to delete the specialist.'
      );
    }

    const specialistQuery = new Parse.Query(Parse.User);
    specialistQuery.equalTo('objectId', specialistId);
    const specialist = await specialistQuery.first({useMasterKey: true});

    if (!specialist) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }

    const specialistRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.SPECIALIST)
      .first({useMasterKey: true});

    if (!specialistRole) {
      throw new Parse.Error(141, 'Specialist role not found.');
    }

    const userRolePointer = specialist.get('role');
    if (!userRolePointer || userRolePointer.id !== specialistRole.id) {
      throw new Parse.Error(141, 'User is not a specialist.');
    }
    await specialist.destroy({useMasterKey: true});

    return {message: 'The specialist was successfully deleted.'};
  }
  @CloudFunction({
    methods: ['DELETE'],
    validation: {
      requireUser: false,
    },
  })
  async deleteAdmin(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const adminId = req.params.adminId;

    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }

    if (!adminId) {
      throw new Parse.Error(141, 'Admin ID must be specified.');
    }

    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});

    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }

    const currentUser = session.get('user');

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');

    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }

    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');

    if (roleName !== SystemRoles.SUPER_ADMIN) {
      throw new Parse.Error(141, 'Only Super Admins can delete Admins.');
    }

    const adminQuery = new Parse.Query(Parse.User);
    adminQuery.equalTo('objectId', adminId);
    const adminUser = await adminQuery.first({useMasterKey: true});

    if (!adminUser) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }

    const adminRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.ADMIN)
      .first({useMasterKey: true});

    if (!adminRole) {
      throw new Parse.Error(141, 'Admin role not found.');
    }

    const userRolePointer = adminUser.get('role');
    if (!userRolePointer || userRolePointer.id !== adminRole.id) {
      throw new Parse.Error(141, 'User is not an Admin.');
    }
    await adminUser.destroy({useMasterKey: true});

    return {message: 'The Admin was successfully deleted.'};
  }

  @CloudFunction({
    methods: ['GET'],
    validation: {
      requireUser: false,
    },
  })
  async getAllChildren(req: Parse.Cloud.FunctionRequest) {
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

    const currentUser = session.get('user');

    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }

    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'Access denied. Only Admin and Super Admin can view children.'
      );
    }

    const childRoleQuery = new Parse.Query(Parse.Role);
    childRoleQuery.equalTo('name', SystemRoles.CHILD);
    const childRole = await childRoleQuery.first({useMasterKey: true});

    if (!childRole) {
      throw new Parse.Error(141, `Role '${SystemRoles.CHILD}' not found`);
    }

    const usersQuery = new Parse.Query(Parse.User);
    usersQuery.equalTo('role', childRole.toPointer());
    usersQuery.include('role');
    usersQuery.limit(1000);
    const children = await usersQuery.find({useMasterKey: true});

    const result = children.map(user => ({
      id: user.id,
      fullName: user.get('fullName') || user.get('name'),
      name: user.get('name') || user.get('fullName'),
      username: user.get('username'),
      mobileNumber:
        user.get('mobileNumber') ||
        user.get('mobile') ||
        user.get('parentPhone') ||
        user.get('phone'),
      mobile:
        user.get('mobile') ||
        user.get('mobileNumber') ||
        user.get('parentPhone') ||
        user.get('phone'),
      parentPhone:
        user.get('parentPhone') ||
        user.get('mobile') ||
        user.get('mobileNumber') ||
        user.get('phone'),
      is_muted: user.get('is_muted') || false,
      mute_until: user.get('mute_until'),
      role: user.get('role')?.get('name'),
    }));

    return result;
  }

  @CloudFunction({
    methods: ['DELETE'],
    validation: {
      requireUser: false,
    },
  })
  async deleteChild(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const childId = req.params.childId;
    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }
    if (!childId) {
      throw new Parse.Error(141, 'Child ID must be specified.');
    }
    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});
    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }
    const currentUser = session.get('user');
    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }
    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;
    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to delete a child.'
      );
    }
    const childQuery = new Parse.Query(Parse.User);
    childQuery.equalTo('objectId', childId);
    const child = await childQuery.first({useMasterKey: true});
    if (!child) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }
    const childRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.CHILD)
      .first({useMasterKey: true});
    if (!childRole) {
      throw new Parse.Error(141, 'Child role not found.');
    }
    const userRolePointer = child.get('role');
    if (!userRolePointer || userRolePointer.id !== childRole.id) {
      throw new Parse.Error(141, 'User is not a child.');
    }
    await child.destroy({useMasterKey: true});
    return {message: 'The child was successfully deleted.'};
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        childId: {required: true, type: String},
      },
    },
  })
  async blockChild(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const {childId} = req.params;
    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }
    if (!childId) {
      throw new Parse.Error(141, 'Child ID must be specified.');
    }
    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});
    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }
    const currentUser = session.get('user');
    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }
    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;
    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to block a child.'
      );
    }
    const childQuery = new Parse.Query(Parse.User);
    childQuery.equalTo('objectId', childId);
    const child = await childQuery.first({useMasterKey: true});
    if (!child) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }
    const childRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.CHILD)
      .first({useMasterKey: true});
    if (!childRole) {
      throw new Parse.Error(141, 'Child role not found.');
    }
    const userRolePointer = child.get('role');
    if (!userRolePointer || userRolePointer.id !== childRole.id) {
      throw new Parse.Error(141, 'User is not a child.');
    }
    child.set('is_blocked', true);
    child.set('blocked_at', new Date());
    await child.save(null, {useMasterKey: true});
    return {
      message: 'The child has been blocked successfully.',
      childId: child.id,
    };
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        childId: {required: true, type: String},
      },
    },
  })
  async unblockChild(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const {childId} = req.params;
    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }
    if (!childId) {
      throw new Parse.Error(141, 'Child ID must be specified.');
    }
    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});
    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }
    const currentUser = session.get('user');
    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }
    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;
    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to unblock a child.'
      );
    }
    const childQuery = new Parse.Query(Parse.User);
    childQuery.equalTo('objectId', childId);
    const child = await childQuery.first({useMasterKey: true});
    if (!child) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }
    const childRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.CHILD)
      .first({useMasterKey: true});
    if (!childRole) {
      throw new Parse.Error(141, 'Child role not found.');
    }
    const userRolePointer = child.get('role');
    if (!userRolePointer || userRolePointer.id !== childRole.id) {
      throw new Parse.Error(141, 'User is not a child.');
    }
    child.set('is_blocked', false);
    child.unset('blocked_at');
    await child.save(null, {useMasterKey: true});
    return {
      message: 'The child has been unblocked successfully.',
      childId: child.id,
    };
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        childId: {required: true, type: String},
      },
    },
  })
  async muteChild(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const {childId, muteUntil} = req.params;
    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }
    if (!childId) {
      throw new Parse.Error(141, 'Child ID must be specified.');
    }
    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});
    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }
    const currentUser = session.get('user');
    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }
    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;
    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to mute a child.'
      );
    }
    const childQuery = new Parse.Query(Parse.User);
    childQuery.equalTo('objectId', childId);
    const child = await childQuery.first({useMasterKey: true});
    if (!child) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }
    child.set('is_muted', true);
    if (muteUntil) {
      child.set('mute_until', new Date(muteUntil));
    }
    await child.save(null, {useMasterKey: true});
    return {
      message: 'The child was successfully muted.',
      childId: child.id,
    };
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        childId: {required: true, type: String},
      },
    },
  })
  async unmuteChild(req: Parse.Cloud.FunctionRequest) {
    const sessionToken = (req as any).headers?.['x-parse-session-token'];
    const {childId} = req.params;
    if (!sessionToken) {
      throw new Parse.Error(141, 'Session token is required');
    }
    if (!childId) {
      throw new Parse.Error(141, 'Child ID must be specified.');
    }
    // البحث عن المستخدم باستخدام Session Token
    const sessionQuery = new Parse.Query(Parse.Session);
    sessionQuery.equalTo('sessionToken', sessionToken);
    sessionQuery.include('user');
    const session = await sessionQuery.first({useMasterKey: true});
    if (!session) {
      throw new Parse.Error(141, 'Invalid session token');
    }
    const currentUser = session.get('user');
    if (!currentUser) {
      throw new Parse.Error(141, 'User not found');
    }
    // جلب المستخدم مع role
    await currentUser.fetch({useMasterKey: true});
    const userRole = currentUser.get('role');
    if (!userRole) {
      throw new Parse.Error(141, 'User has no role assigned');
    }
    await userRole.fetch({useMasterKey: true});
    const roleName = userRole.get('name');
    const hasPermission =
      roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;
    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to unmute a child.'
      );
    }
    const childQuery = new Parse.Query(Parse.User);
    childQuery.equalTo('objectId', childId);
    const child = await childQuery.first({useMasterKey: true});
    if (!child) {
      throw new Parse.Error(101, 'No user found with this ID.');
    }
    child.set('is_muted', false);
    child.unset('mute_until');
    await child.save(null, {useMasterKey: true});
    return {
      message: 'The child was successfully unmuted.',
      childId: child.id,
    };
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addDoctor(req: Parse.Cloud.FunctionRequest) {
    const currentUser = req.user;
    const {fullName, username, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.containedIn('name', [SystemRoles.ADMIN, SystemRoles.SUPER_ADMIN]);
    roleQuery.equalTo('users', currentUser);
    const hasPermission = await roleQuery.first({useMasterKey: true});

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to add a doctor.'
      );
    }

    const doctorRoleQuery = new Parse.Query(Parse.Role);
    doctorRoleQuery.equalTo('name', SystemRoles.DOCTOR);
    const doctorRole = await doctorRoleQuery.first({useMasterKey: true});

    if (!doctorRole) {
      throw new Parse.Error(141, `Role '${SystemRoles.DOCTOR}' not found`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (existingUser) {
      throw new Parse.Error(141, 'Username already exists.');
    }

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', doctorRole.toPointer());
    if (mobile) user.set('mobile', mobile);
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    doctorRole.relation('users').add(user);
    await doctorRole.save(null, {useMasterKey: true});

    return {
      message: 'Doctor created successfully',
      userId: user.id,
      username,
      role: SystemRoles.DOCTOR,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        doctorId: {required: true, type: String},
        fullName: {required: false, type: String},
        password: {required: false, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async editDoctor(req: Parse.Cloud.FunctionRequest) {
    const currentUser = req.user;
    const {doctorId, fullName, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.containedIn('name', [SystemRoles.ADMIN, SystemRoles.SUPER_ADMIN]);
    roleQuery.equalTo('users', currentUser);
    const hasPermission = await roleQuery.first({useMasterKey: true});

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to edit a doctor.'
      );
    }

    const doctorQuery = new Parse.Query(Parse.User);
    doctorQuery.equalTo('objectId', doctorId);
    const doctor = await doctorQuery.first({useMasterKey: true});

    if (!doctor) {
      throw new Parse.Error(101, 'No doctor found with this ID.');
    }

    const doctorRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.DOCTOR)
      .first({useMasterKey: true});

    if (!doctorRole) {
      throw new Parse.Error(141, 'Doctor role not found.');
    }

    const userRolePointer = doctor.get('role');
    if (!userRolePointer || userRolePointer.id !== doctorRole.id) {
      throw new Parse.Error(141, 'User is not a doctor.');
    }

    if (fullName) doctor.set('fullName', fullName);
    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      passwordQuery.notEqualTo('objectId', doctorId);
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }

      doctor.set('password', password);
      doctor.set('passwordDisplay', password);
    }
    if (mobile) doctor.set('mobile', mobile);
    if (email) doctor.set('email', email);

    await doctor.save(null, {useMasterKey: true});

    return {
      message: 'Doctor updated successfully',
      doctorId: doctor.id,
      username: doctor.get('username'),
      role: SystemRoles.DOCTOR,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addSpecialist(req: Parse.Cloud.FunctionRequest) {
    const currentUser = req.user;
    const {fullName, username, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.containedIn('name', [SystemRoles.ADMIN, SystemRoles.SUPER_ADMIN]);
    roleQuery.equalTo('users', currentUser);
    const hasPermission = await roleQuery.first({useMasterKey: true});

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to add a specialist.'
      );
    }

    const specialistRoleQuery = new Parse.Query(Parse.Role);
    specialistRoleQuery.equalTo('name', SystemRoles.SPECIALIST);
    const specialistRole = await specialistRoleQuery.first({
      useMasterKey: true,
    });

    if (!specialistRole) {
      throw new Parse.Error(141, `Role '${SystemRoles.SPECIALIST}' not found`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (existingUser) {
      throw new Parse.Error(141, 'Username already exists.');
    }

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', specialistRole.toPointer());
    if (mobile) user.set('mobile', mobile);
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    specialistRole.relation('users').add(user);
    await specialistRole.save(null, {useMasterKey: true});

    return {
      message: 'Specialist created successfully',
      userId: user.id,
      username,
      role: SystemRoles.SPECIALIST,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        specialistId: {required: true, type: String},
        fullName: {required: false, type: String},
        password: {required: false, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async editSpecialist(req: Parse.Cloud.FunctionRequest) {
    const currentUser = req.user;
    const {specialistId, fullName, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.containedIn('name', [SystemRoles.ADMIN, SystemRoles.SUPER_ADMIN]);
    roleQuery.equalTo('users', currentUser);
    const hasPermission = await roleQuery.first({useMasterKey: true});

    if (!hasPermission) {
      throw new Parse.Error(
        141,
        'You do not have the authority to edit a specialist.'
      );
    }

    const specialistQuery = new Parse.Query(Parse.User);
    specialistQuery.equalTo('objectId', specialistId);
    const specialist = await specialistQuery.first({useMasterKey: true});

    if (!specialist) {
      throw new Parse.Error(101, 'No specialist found with this ID.');
    }

    const specialistRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.SPECIALIST)
      .first({useMasterKey: true});

    if (!specialistRole) {
      throw new Parse.Error(141, 'Specialist role not found.');
    }

    const userRolePointer = specialist.get('role');
    if (!userRolePointer || userRolePointer.id !== specialistRole.id) {
      throw new Parse.Error(141, 'User is not a specialist.');
    }

    if (fullName) specialist.set('fullName', fullName);
    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      passwordQuery.notEqualTo('objectId', specialistId);
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }

      specialist.set('password', password);
      specialist.set('passwordDisplay', password);
    }
    if (mobile) specialist.set('mobile', mobile);
    if (email) specialist.set('email', email);

    await specialist.save(null, {useMasterKey: true});

    return {
      message: 'Specialist updated successfully',
      specialistId: specialist.id,
      username: specialist.get('username'),
      role: SystemRoles.SPECIALIST,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        fullName: {required: true, type: String},
        username: {required: true, type: String},
        password: {required: true, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async addAdmin(req: Parse.Cloud.FunctionRequest) {
    const currentUser = req.user;
    const {fullName, username, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.SUPER_ADMIN);
    roleQuery.equalTo('users', currentUser);
    const isSuperAdmin = await roleQuery.first({useMasterKey: true});

    if (!isSuperAdmin) {
      throw new Parse.Error(
        141,
        'Access denied. Only Super Admin can add admins.'
      );
    }

    const adminRoleQuery = new Parse.Query(Parse.Role);
    adminRoleQuery.equalTo('name', SystemRoles.ADMIN);
    const adminRole = await adminRoleQuery.first({useMasterKey: true});

    if (!adminRole) {
      throw new Parse.Error(141, `Role '${SystemRoles.ADMIN}' not found`);
    }

    const existingUser = await new Parse.Query(Parse.User)
      .equalTo('username', username)
      .first({useMasterKey: true});

    if (existingUser) {
      throw new Parse.Error(141, 'Username already exists.');
    }

    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }
    }

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', password);
    user.set('passwordDisplay', password);
    user.set('fullName', fullName);
    user.set('role', adminRole.toPointer());
    if (mobile) user.set('mobile', mobile);
    if (email) user.set('email', email);

    await user.signUp(null, {useMasterKey: true});

    adminRole.relation('users').add(user);
    await adminRole.save(null, {useMasterKey: true});

    return {
      message: 'Admin created successfully',
      userId: user.id,
      username,
      role: SystemRoles.ADMIN,
    };
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        adminId: {required: true, type: String},
        fullName: {required: false, type: String},
        password: {required: false, type: String},
        mobile: {required: false, type: String},
        email: {required: false, type: String},
      },
    },
  })
  async editAdmin(req: Parse.Cloud.FunctionRequest) {
    const currentUser = req.user;
    const {adminId, fullName, password, mobile, email} = req.params;

    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', SystemRoles.SUPER_ADMIN);
    roleQuery.equalTo('users', currentUser);
    const isSuperAdmin = await roleQuery.first({useMasterKey: true});

    if (!isSuperAdmin) {
      throw new Parse.Error(
        141,
        'Access denied. Only Super Admin can edit admins.'
      );
    }

    const adminQuery = new Parse.Query(Parse.User);
    adminQuery.equalTo('objectId', adminId);
    const admin = await adminQuery.first({useMasterKey: true});

    if (!admin) {
      throw new Parse.Error(101, 'No admin found with this ID.');
    }

    const adminRole = await new Parse.Query(Parse.Role)
      .equalTo('name', SystemRoles.ADMIN)
      .first({useMasterKey: true});

    if (!adminRole) {
      throw new Parse.Error(141, 'Admin role not found.');
    }

    const userRolePointer = admin.get('role');
    if (!userRolePointer || userRolePointer.id !== adminRole.id) {
      throw new Parse.Error(141, 'User is not an admin.');
    }

    if (fullName) admin.set('fullName', fullName);
    if (password && password !== '********' && password !== 'temp123') {
      const passwordQuery = new Parse.Query(Parse.User);
      passwordQuery.equalTo('passwordDisplay', password);
      passwordQuery.notEqualTo('objectId', adminId);
      const duplicatePasswordUser = await passwordQuery.first({
        useMasterKey: true,
      });
      if (duplicatePasswordUser) {
        throw new Parse.Error(
          141,
          'عذراً، كلمة السر هذه مستخدمة من قبل مستخدم آخر. يرجى اختيار كلمة سر فريدة للمتابعة.'
        );
      }

      admin.set('password', password);
      admin.set('passwordDisplay', password);
    }
    if (mobile) admin.set('mobile', mobile);
    if (email) admin.set('email', email);

    await admin.save(null, {useMasterKey: true});

    return {
      message: 'Admin updated successfully',
      adminId: admin.id,
      username: admin.get('username'),
      role: SystemRoles.ADMIN,
    };
  }

  /**
   * جلب قائمة الأطباء أو الأخصائيين النفسيين حسب النوع
   * @param provider_type - 'Doctor' أو 'Psychologist'
   */
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        provider_type: {required: true, type: String},
      },
    },
  })
  async getProvidersByType(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];

      if (!sessionToken) {
        throw {
          codeStatus: 101,
          message: 'Session token is required',
        };
      }

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});

      if (!session) {
        throw {
          codeStatus: 101,
          message: 'Invalid session token',
        };
      }

      const currentUser = session.get('user');
      if (!currentUser) {
        throw {
          codeStatus: 101,
          message: 'User not found',
        };
      }

      const {provider_type} = req.params;

      const validTypes = ['Doctor', 'Psychologist'];
      if (!validTypes.includes(provider_type)) {
        throw {
          codeStatus: 105,
          message: `Invalid provider type. Must be 'Doctor' or 'Psychologist'`,
        };
      }

      const roleName =
        provider_type === 'Doctor'
          ? SystemRoles.DOCTOR
          : SystemRoles.SPECIALIST;

      const roleQuery = new Parse.Query(Parse.Role);
      roleQuery.equalTo('name', roleName);
      const role = await roleQuery.first({useMasterKey: true});

      if (!role) {
        throw {
          codeStatus: 104,
          message: `Role '${roleName}' not found`,
        };
      }

      const usersQuery = new Parse.Query(Parse.User);
      usersQuery.equalTo('role', role);
      usersQuery.include('role');
      const providers = await usersQuery.find({useMasterKey: true});

      const result = providers.map(user => ({
        id: user.id,
        fullName: user.get('fullName') || user.get('username'),
        username: user.get('username'),
        email: user.get('email'),
        mobile: user.get('mobile'),
        specialization: user.get('specialization') || provider_type,
        profilePic: user.get('profilePic'),
        role: user.get('role')?.get('name'),
      }));

      return result;
    } catch (error: any) {
      console.error('Error in getProvidersByType:', error);
      throw {
        codeStatus: error.codeStatus || 1020,
        message: error.message || 'Failed to retrieve providers',
      };
    }
  }
}

export default new User_();
