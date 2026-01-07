import { join } from 'path';
import { importFiles } from './utils/dynamicImport';

console.log('|||||||||||| Import Models ||||||||||||');
const mainModelsPath = join(__dirname, 'models');
importFiles(mainModelsPath);

console.log('|||||||||||| Import Modules ||||||||||||');
const mainModulesPath = join(__dirname, 'modules');
importFiles(mainModulesPath);

console.log('---main.js File Initialized---');
