import {CloudFunctionMetadata} from '../types/cloud';

export class CloudFunctionRegistry {
  private static functions: Map<string, CloudFunctionMetadata> = new Map();

  static register(metadata: CloudFunctionMetadata) {
    this.functions.set(metadata.name, metadata);
  }

  static getFunctions() {
    return Array.from(this.functions.values());
  }

  static getFunction(name: string) {
    return this.functions.get(name);
  }

  static initialize() {
    this.functions.forEach(metadata => {
      Parse.Cloud.define(
        metadata.name,
        metadata.handler,
        metadata.config.validation
      );
      console.log(`Registered cloud function: ${metadata.name}`);
    });
  }
}
