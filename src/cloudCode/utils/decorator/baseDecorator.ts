import 'reflect-metadata';
import {classLevelPermissions, classNames} from '../schema/schemaTypes';
import {ClassNameType} from '../schema/classNameType';

export type AllowedFieldType =
  | {type: 'String'; required?: boolean}
  | {type: 'Number'; required?: boolean}
  | {type: 'Boolean'; required?: boolean}
  | {type: 'Date'; required?: boolean}
  | {type: 'Object'; required?: boolean}
  | {type: 'Array'; required?: boolean}
  | {type: 'GeoPoint'; required?: boolean}
  | {type: 'File'; required?: boolean}
  | {type: 'Bytes'; required?: boolean}
  | {type: 'Polygon'; required?: boolean}
  | {type: 'Pointer'; targetClass: string; required: boolean}
  | {type: 'Relation'; targetClass: string; required: boolean};

const VALID_TYPES = new Set([
  'String',
  'Number',
  'Boolean',
  'Date',
  'Object',
  'Array',
  'GeoPoint',
  'File',
  'Bytes',
  'Polygon',
  'Pointer',
  'Relation',
]);

export function ParseField(
  type: AllowedFieldType['type'],
  required: boolean = false,
  targetClass?: ClassNameType
) {
  if (!VALID_TYPES.has(type)) {
    throw new Error(
      `Invalid field type: ${type}. Must be one of ${Array.from(
        VALID_TYPES
      ).join(', ')}`
    );
  }

  if ((type === 'Pointer' || type === 'Relation') && !targetClass) {
    throw new Error(`Field of type '${type}' must have a targetClass.`);
  }

  return function (target: Object, propertyKey: string | symbol) {
    const className = target.constructor.name;

    const existingFields =
      Reflect.getMetadata('parse:fields', target.constructor) || {};

    existingFields[propertyKey as string] = targetClass
      ? {type, targetClass, required}
      : {type, required};

    Reflect.defineMetadata('parse:fields', existingFields, target.constructor);

    Object.defineProperty(target, propertyKey, {
      get(this: Parse.Object) {
        return this.get(propertyKey as string);
      },
      set(this: Parse.Object, value: any) {
        this.set(propertyKey as string, value);
      },
      enumerable: true,
      configurable: true,
    });
  };
}

export function ParseClass(
  className: any,
  options: {
    clp?: classLevelPermissions;
  } = {}
) {
  return function (constructor: Function): void {
    Reflect.defineMetadata(
      'parse:className',
      className.toString(),
      constructor
    );
    Reflect.defineMetadata('parse:clp', options.clp, constructor);

    const isRoleSubclass = constructor.prototype instanceof Parse.Role;

    if (!isRoleSubclass) {
      Parse.Object.registerSubclass(
        className,
        constructor as unknown as typeof Parse.Object
      );
    } else {
      console.warn(`Skipped registerSubclass for Role subclass: ${className}`);
    }

    if (!classNames.includes(className)) {
      classNames.push(className);
    }

    console.log(`Registered Parse class: ${className}`);
  };
}

export function getSchemaDefinition<T>(
  target: new () => T,
  isPublic: boolean = false
) {
  const name = Reflect.getMetadata('parse:className', target);
  const fields = Reflect.getMetadata('parse:fields', target) || {};
  const customCLP = Reflect.getMetadata('parse:clp', target);

  let classLevelPermissions: any;

  if (customCLP) {
    classLevelPermissions = {...customCLP};
  } else {
    const Get = `role:${name}-role-r`;
    const Create = `role:${name}-role-c`;
    const Delete = `role:${name}-role-d`;
    const Update = `role:${name}-role-u`;

    classLevelPermissions = {
      get: {'role:SuperAdmin': true, [Get]: true, ...(isPublic && {'*': true})},
      create: {'role:SuperAdmin': true, [Create]: true},
      delete: {'role:SuperAdmin': true, [Delete]: true},
      update: {'role:SuperAdmin': true, [Update]: true},
      count: {
        'role:SuperAdmin': true,
        [Get]: true,
        ...(isPublic && {'*': true}),
      },
      find: {
        'role:SuperAdmin': true,
        [Get]: true,
        ...(isPublic && {'*': true}),
      },
      protectedFields: {},
    };
  }

  const operations = ['find', 'get', 'create', 'update', 'delete', 'count'];
  operations.forEach(op => {
    if (!classLevelPermissions[op]) {
      classLevelPermissions[op] = {};
    }
  });

  return {
    className: name,
    fields,
    classLevelPermissions,
  };
}
