import User from '../models/User';

type RoleRule = {role: string; read?: boolean; write?: boolean};

export function implementACL(params: {
  publicRead?: boolean;
  publicWrite?: boolean;
  roleRules: RoleRule[];
  excludedRoles?: string[];
  owner?: {user: string | User; read?: boolean; write?: boolean};
}): Parse.ACL {
  const {
    publicRead = false,
    publicWrite = false,
    roleRules,
    excludedRoles = [],
    owner,
  } = params;

  const acl = new Parse.ACL();

  acl.setPublicReadAccess(!!publicRead);
  acl.setPublicWriteAccess(!!publicWrite);

  for (const {role, read = false, write = false} of roleRules) {
    if (excludedRoles.includes(role)) continue;
    if (read) acl.setRoleReadAccess(role, true);
    acl.setRoleWriteAccess(role, !!write);
  }

  if (owner) {
    if (owner.read) acl.setReadAccess(owner.user, true);
    if (owner.write) acl.setWriteAccess(owner.user, true);
  }

  return acl;
}
export async function hasRole(
  user: Parse.User,
  roleName: string
): Promise<boolean> {
  const roleQuery = new Parse.Query(Parse.Role);
  roleQuery.equalTo('users', user);
  roleQuery.equalTo('isCustom', true);
  roleQuery.equalTo('name', roleName);

  const count = await roleQuery.count({useMasterKey: true});
  return count > 0;
}
