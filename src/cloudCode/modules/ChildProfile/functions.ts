import ChildProfile from '../../models/ChildProfile';
import {CloudFunction} from '../../utils/Registry/decorators';

class ChildProfile_ {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {required: false, type: String},
      },
    },
  })
  async getMyChildProfile(req: Parse.Cloud.FunctionRequest) {
    try {
      const {child_id} = req.params;
      let user: Parse.User | undefined;

      // إذا كان child_id موجود، استخدمه
      if (child_id) {
        const userQuery = new Parse.Query(Parse.User);
        user = await userQuery.get(child_id, {useMasterKey: true});
      } else if (req.user) {
        // وإلا استخدم req.user إذا كان موجود
        user = req.user;
      } else {
        const sessionToken = (req as any).headers[
          'x-parse-session-token'
        ] as string;
        if (sessionToken) {
          const sessionQuery = new Parse.Query(Parse.Session);
          sessionQuery.equalTo('sessionToken', sessionToken);
          sessionQuery.include('user');
          const session = await sessionQuery.first({useMasterKey: true});
          if (session) {
            user = session.get('user');
          }
        }
      }

      if (!user) {
        throw {
          codeStatus: 103,
          message: 'User context is missing',
        };
      }

      if (!user) {
        throw {
          codeStatus: 103,
          message: 'User not found',
        };
      }
      const rolePointer = user.get('role');

      const role = await new Parse.Query(Parse.Role)
        .equalTo('objectId', rolePointer?.id)
        .first({useMasterKey: true});

      const roleName = role?.get('name');
      if (roleName !== 'Child') {
        throw {
          codeStatus: 102,
          message: 'User is not a Child',
        };
      }

      const query = new Parse.Query(ChildProfile);
      query.equalTo('user', user);
      query.include('user');

      let child = await query.first({useMasterKey: true});

      if (!child) {
        child = new ChildProfile();
        child.set('user', user);
        child.set('name', 'Child');
        child.set('gender', 'Unknown');
        await child.save(null, {useMasterKey: true});
      }

      return child.toJSON();
    } catch (error: any) {
      console.error('Error in getMyChildProfile:', error);
      if (error.codeStatus) {
        throw error;
      }
      throw {
        codeStatus: 1000,
        message: error.message || 'Failed to retrieve or create child profile',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        childId: {required: true, type: String},
        name: {required: false, type: String},
        fatherName: {required: false, type: String},
        birthdate: {required: false, type: String},
        gender: {required: false, type: String},
        medical_info: {required: false, type: String},
      },
    },
  })
  async createOrUpdateChildProfile(req: Parse.Cloud.FunctionRequest) {
    const {childId, name, fatherName, birthdate, gender, medical_info} =
      req.params;

    try {
      const userQuery = new Parse.Query(Parse.User);
      userQuery.equalTo('objectId', childId);
      userQuery.include('role');
      const user = await userQuery.first({useMasterKey: true});

      if (!user) {
        throw {
          codeStatus: 101,
          message: 'User not found',
        };
      }

      const roleName = user.get('role')?.get('name');
      if (roleName !== 'Child') {
        throw {
          codeStatus: 102,
          message: 'User is not a Child',
        };
      }

      let profile: ChildProfile | undefined;

      const profileQuery = new Parse.Query(ChildProfile);
      profileQuery.equalTo('user', user);
      profile = await profileQuery.first({useMasterKey: true});

      if (!profile) {
        profile = new ChildProfile();
        profile.set('user', user);
      }

      if (name) profile.set('name', name);
      if (fatherName) profile.set('fatherName', fatherName);

      // تحويل birthdate من String إلى Date
      if (birthdate) {
        try {
          let dateObj: Date;
          if (typeof birthdate === 'string' && birthdate.includes('/')) {
            const [day, month, year] = birthdate.split('/').map(Number);
            dateObj = new Date(year, month - 1, day);
          } else {
            dateObj = new Date(birthdate);
          }

          if (!isNaN(dateObj.getTime())) {
            profile.set('birthdate', dateObj);
          } else {
            console.warn('Invalid birthdate format:', birthdate);
          }
        } catch (e) {
          console.warn('Error parsing birthdate:', e);
        }
      }

      if (gender) profile.set('gender', gender);
      if (medical_info) profile.set('medical_info', medical_info);

      if (name) user.set('fullName', name);
      if (fatherName) user.set('fatherName', fatherName);

      await Promise.all([
        profile.save(null, {useMasterKey: true}),
        user.save(null, {useMasterKey: true}),
      ]);

      const finalProfile = await new Parse.Query(ChildProfile)
        .include('user')
        .get(profile.id, {useMasterKey: true});

      return finalProfile;
    } catch (error: any) {
      console.error('Error in createOrUpdateChildProfile:', error);
      if (error.codeStatus) {
        throw error;
      }
      throw {
        codeStatus: 1000,
        message: error.message || 'Failed to create or update child profile',
      };
    }
  }
}

export default ChildProfile_;
