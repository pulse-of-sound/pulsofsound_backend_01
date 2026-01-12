import {Anonymous} from '../modules/authAdapters/models/Anonymous';
import {EmailAuth} from '../modules/authAdapters/models/EmailAuth';
import {MobileAuth} from '../modules/authAdapters/models/MobileAuth';
import {ParseClass, ParseField} from '../utils/decorator/baseDecorator';
import AccountStatus from './AccountStatus';
import UserBlock from './UserBlock';
import UserDeleted from './UserDelete';

@ParseClass('_User', {
  clp: {
    find: '*',
    get: '*',
    create: '*',
    update: '*',
    delete: '*',
  },
})
export default class User extends Parse.User {
    user(user: any) {
    throw new Error('Method not implemented.');
  }
  constructor() {
    super();
  }

  @ParseField('Object', false)
  authData!: MobileAuth | EmailAuth | Anonymous;

  @ParseField('String', false)
  username!: string;

  @ParseField('String', false)
  fcm_token!: string;

  @ParseField('String', false)
  mobileNumber!: string;

  @ParseField('String', false)
  fullName!: string;

  @ParseField('Pointer', false, '_Role')
  role!: Parse.Role;

  @ParseField('Pointer', false, 'UserBlock')
  userBlock!: UserBlock;

  @ParseField('Pointer', false, 'UserDeleted')
  deleted!: UserDeleted;

  @ParseField('Pointer', false, 'AccountStatus')
  accountStatus!: AccountStatus;

  @ParseField('Boolean', false)
  status!: boolean;

  @ParseField('Date', false)
  birthDate!: Date;

  @ParseField('String', false)
  fatherName!: string;

  @ParseField('String', false)
  gender!: string;

  @ParseField('String', false)
  medical_info!: string;

  @ParseField('String', false)
  specialty!: string;

  @ParseField('File', false)
  profilePic!: Parse.File;

  @ParseField('String', false)
  passwordDisplay!: string;

  static map(user?: User, assignedRole?: Parse.Role) {
    if (!user) {
      return {};
    }

    const userObject = {
      id: user.id,
      email: user.get('email'),
      username: user.get('username'),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      status: user.get('status'),
      mobileNumber: user.get('mobileNumber'),
      fullName: user.get('fullName'),
      birthDate: user.get('birthDate'),
      fatherName: user.get('fatherName'),
      gender: user.get('gender'),
      specialty: user.get('specialty'),
      medical_info: user.get('medical_info'),
      profilePic: user.get('profilePic')
        ? {
            __type: 'File',
            name: user.get('profilePic').name(),
            url: user.get('profilePic').url(),
          }
        : null,
      placement_test_score: user.get('placement_test_score'),
    };

    const flattenedObject = {
      ...userObject,
      role: assignedRole?.toPointer(),
    };

    return flattenedObject;
  }
//يتم إنشاء مستخدم جديد
  static async createUserRecord(userParams: any) {
    const user = new User();
//إذا مرر id باخدو احسن ما أنشأ واحد جديد
    if (userParams?.id) {
      user.id = userParams.id;
    }
//اذا ما مرر الاسم باخد الاسم الموجود او الايميل
    if (!userParams.username) {
      userParams.username =
        userParams.username ||
        userParams.email ||
        `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
//يتم انشأ سجل جديد بقلب  userblock قيتمه الابتدائية غير محظور

    if (!userParams.id) {
      const userBlock = new UserBlock();
      userBlock.isBlocked = false;
//يتم إنشأ سجل جديد بقلب  UserDeleted قيمته الابتدائية غير محذوف
      const userDeleted = new UserDeleted();
      userDeleted.isDeleted = false;
//يجلب حالة الحساب الافتراضية code=1يعني مفعل وطبعا بتحتاج صلاحيات اعلى ف نحن بحاجة ل maseterzkey
      const accountStatus = (await new Parse.Query(AccountStatus)
        .equalTo('code', '1')
        .first({useMasterKey: true})) as AccountStatus;
//محفظ السجلات معا
      const [block, deleted] = await Promise.all([
        userBlock.save(null, {useMasterKey: true}),
        userDeleted.save(null, {useMasterKey: true}),
      ]);
//يربط المستخدم بسجلات الحظر و الحذف وحالة الحسبا
      user.set({
        userBlock: block,
        deleted: deleted,
        accountStatus: accountStatus,

        birthDate: new Date('2000-01-01'),
        fatherName: 'fatherName ',
        profilePic: null,
      });
    }

    user.set({
      ...userParams,
    });

    return {
      user,
    };
  }
//إسناد دور لمستخدم
  static async assignRoleToUser(user: Parse.User, roleIdOrName: string) {
    const nameQuery = new Parse.Query(Parse.Role).equalTo('name', roleIdOrName);
    const idQuery = new Parse.Query(Parse.Role).equalTo(
      'objectId',
      roleIdOrName
    );

    const roleQuery = Parse.Query.or(nameQuery, idQuery);
    const role = await roleQuery.first({useMasterKey: true});

    const relation = role?.relation('users');
    relation?.add(user);
    await role?.save(null, {useMasterKey: true});
    return role;
  }
}
