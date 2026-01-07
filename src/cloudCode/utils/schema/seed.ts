import * as fs from 'fs';
import * as path from 'path';
import {UserRoles} from '../constants';
import User from '../../models/User';
const countriesLib = require('i18n-iso-countries');

countriesLib.registerLocale(require('i18n-iso-countries/langs/en.json'));
countriesLib.registerLocale(require('i18n-iso-countries/langs/ar.json'));
const IMAGES_FOLDER_PATH = path.join(__dirname, '../../assets');

export function verifyImagesFolder() {
  try {
    if (!fs.existsSync(IMAGES_FOLDER_PATH)) {
      console.error(`Images folder not found: ${IMAGES_FOLDER_PATH}`);
      return false;
    }

    const imageFiles = fs
      .readdirSync(IMAGES_FOLDER_PATH)
      .filter(
        file =>
          file.toLowerCase().endsWith('.svg') ||
          file.toLowerCase().endsWith('.jpg') ||
          file.toLowerCase().endsWith('.jpeg') ||
          file.toLowerCase().endsWith('.png') ||
          file.toLowerCase().endsWith('.jfif')
      );

    console.log(`Images folder found: ${IMAGES_FOLDER_PATH}`);
    console.log(` Found ${imageFiles.length} image files:`);
    imageFiles.forEach(file => console.log(`   - ${file}`));

    return true;
  } catch (error) {
    console.error(' Error verifying images folder:', error);
    return false;
  }
}
export async function seedCustomRoles() {
  const roles = Object.values(UserRoles);
  for (const role of roles) {
    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', role);
    roleQuery.equalTo('isCustom', true);
    const existingRole = await roleQuery.first({useMasterKey: true});
    if (!existingRole) {
      console.log(`Creating role: ${role}`);
      const roleAcl = new Parse.ACL();
      roleAcl.setPublicReadAccess(false);
      roleAcl.setPublicWriteAccess(false);
      roleAcl.setRoleReadAccess(UserRoles.SUPER_ADMIN, true);
      roleAcl.setRoleWriteAccess(UserRoles.SUPER_ADMIN, true);
      const roleObj = new Parse.Role(role, roleAcl);
      roleObj.set('isCustom', true);
      await roleObj.save(null, {useMasterKey: true});
      console.log(`Role ${role} created successfully.`);
    }
  }
  console.log('Custom role seeding completed.');
}

async function seedUsers() {
  const userData = {
    username: 'super',
    password: 'super',
    email: 'admin@test.com',
  };

  const query = new Parse.Query(User);
  query.equalTo('username', userData.username);
  const exists = await query.first({useMasterKey: true});

  if (!exists) {
    const user = new User();
    user.set('username', userData.username);
    user.set('password', userData.password);
    user.set('email', userData.email);

    try {
      await user.save(null, {useMasterKey: true});
      console.log(`Seeded user: ${userData.username}`);

      const roleQuery = new Parse.Query(Parse.Role);
      roleQuery.equalTo('name', 'SuperAdmin');
      const superAdminRole = await roleQuery.first({useMasterKey: true});

      if (superAdminRole) {
        superAdminRole.getUsers().add(user);
        await superAdminRole.save(null, {useMasterKey: true});
        console.log(`Assigned SuperAdmin role to user: ${userData.username}`);
      } else {
        console.error('SuperAdmin role not found in database');
      }
    } catch (err) {
      console.error(`Failed to seed user ${userData.username}:`, err);
    }
  } else {
    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', 'SuperAdmin');
    const superAdminRole = await roleQuery.first({useMasterKey: true});

    if (superAdminRole) {
      const userRoleQuery = new Parse.Query(Parse.Role);
      userRoleQuery.equalTo('name', 'SuperAdmin');
      userRoleQuery.equalTo('users', exists);
      const userHasRole = await userRoleQuery.first({useMasterKey: true});

      if (!userHasRole) {
        superAdminRole.getUsers().add(exists);
        await superAdminRole.save(null, {useMasterKey: true});
        console.log(
          `Assigned SuperAdmin role to existing user: ${userData.username}`
        );
      } else {
        console.log(`User ${userData.username} already has SuperAdmin role`);
      }
    } else {
      console.error('SuperAdmin role not found in database');
    }
  }

  console.log('User seeding complete!');
}

async function seedAccountStatus() {
  const accountstatuses = [
    {code: '1', name: {en: 'Active', ar: 'نشط'}},
    {code: '2', name: {en: 'Inactive', ar: 'غير نشط'}},
    {code: '3', name: {en: 'Blocked', ar: 'محظور'}},
  ];
  for (const status of accountstatuses) {
    const query = new Parse.Query('AccountStatus');
    query.equalTo('code', status.code);
    const exists = await query.first({useMasterKey: true});
    if (!exists) {
      const accountStatus = new Parse.Object('AccountStatus');
      accountStatus.set('code', status.code);
      accountStatus.set('name', status.name);
      await accountStatus.save(null, {useMasterKey: true});
    }
  }
  console.log('AccountStatus seeding complete!');
}

async function createFileFromLocalImage(
  imagePath: string,
  fileName: string
): Promise<Parse.File> {
  try {
    const fileBuffer = fs.readFileSync(imagePath);

    const base64 = fileBuffer.toString('base64');

    const fileExtension = path.extname(fileName).toLowerCase();
    let mimeType = 'image/jpeg';

    if (fileExtension === '.svg') {
      mimeType = 'image/svg+xml';
    } else if (fileExtension === '.png') {
      mimeType = 'image/png';
    } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (fileExtension === '.jfif') {
      mimeType = 'image/jpeg';
    }

    const parseFile = new Parse.File(fileName, {base64}, mimeType);

    return await parseFile.save({useMasterKey: true});
  } catch (error) {
    console.error(`Error creating file from ${imagePath}:`, error);
    throw error;
  }
}
export async function seedAll() {
  await seedCustomRoles();
  await seedUsers();
  await seedAccountStatus();
  console.log('All seeders completed!');
}
