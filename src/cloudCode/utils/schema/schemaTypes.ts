import {ClassNameType} from './classNameType';

type CLPParamsOption =
  | {}
  | '*'
  | {requiresAuthentication: boolean}
  | {[key: string]: boolean};

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
  | {type: 'Pointer'; targetClass: ClassNameType; required: boolean}
  | {type: 'Relation'; targetClass: ClassNameType; required: boolean};

export interface Fields {
  [key: string]: AllowedFieldType;
}

export interface Indexes {
  [indexName: string]: {[fieldName: string]: number};
}

export interface ProtectedFields {
  '*': string[];
  [key: string]: string[];
}

export interface classLevelPermissions {
  find?: CLPParamsOption;
  get?: CLPParamsOption;
  count?: CLPParamsOption;
  create?: CLPParamsOption;
  update?: CLPParamsOption;
  delete?: CLPParamsOption;
  protectedFields?: ProtectedFields;
}

export interface SchemaDefinition {
  className: ClassNameType;
  fields: Fields;
  indexes?: Indexes;
  classLevelPermissions?: classLevelPermissions;
}
export const classNames: ClassNameType[] = [];
