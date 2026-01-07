import express = require('express');
require('dotenv').config();
import {NextFunction, Request, Response} from 'express';

const cors = require('cors');
const ParseServer = require('parse-server').ParseServer;
const app = express();
const server = require('http').createServer(app);

import {join} from 'path';
import {importFiles} from './cloudCode/utils/dynamicImport';

console.log('|||||||||||| Pre-loading Models for Schema ||||||||||||');
const mainModelsPath = join(__dirname, 'cloudCode/models');
importFiles(mainModelsPath);

import MobileAuth = require('./cloudCode/modules/authAdapters/mobileAuth');
import EmailAuth = require('./cloudCode/modules/authAdapters/emailAuth');

import path = require('path');

import {CloudFunctionRegistry} from './cloudCode/utils/Registry/registry';
import {LoggerAdapter} from './cloudCode/utils/loger';
import FileAdapter from './cloudCode/utils/fileAdapter';
import nodemailer from 'nodemailer';
import {getSchemaDefinition} from './cloudCode/utils/decorator/baseDecorator';
import {ClassNameType} from './cloudCode/utils/schema/classNameType';
import {HttpMethod} from './cloudCode/utils/types/cloud';
import {seedAll} from './cloudCode/utils/schema/seed';
import {classNames} from './cloudCode/utils/schema/schemaTypes';
const publicClassNames: ClassNameType[] = [];

const parseConfig = {
  liveQuery: {
    classNames: [],
  },
  enableInsecureAuthAdapters: false,
  auth: {
    mobileAuth: {enabled: true, module: MobileAuth},
  },
  databaseURI: process.env.databaseURI,
  appName: process.env.appName,
  appId: process.env.appId,
  restAPIKey: process.env.restAPIKey,
  cloud: './build/src/cloudCode/main.js',
  masterKey: process.env.masterKey,
  javascriptKey: process.env.javascriptKey,
  serverURL: process.env.serverURL,
  masterKeyIps: ['::/0', '0.0.0.0/0'],
  publicServerURL: process.env.publicServerURL,
  mountPath: process.env.mountPath,
  loggerAdapter: LoggerAdapter,
  filesAdapter: new FileAdapter({filesDir: path.resolve('./', 'files')}),
  fileUpload: {
    enableForAnonymousUser: true,
    enableForAuthenticatedUser: true,
    enableForPublic: false,
  },

  schema: {
    definitions: [
      {
        className: '_Role',
        fields: {},
        classLevelPermissions: {
          find: {'role:SuperAdmin': true, 'role:Admin': true},
          get: {'role:SuperAdmin': true, 'role:Admin': true},
          count: {'role:SuperAdmin': true, 'role:Admin': true},
          create: {'role:SuperAdmin': true, 'role:Admin': true},
          update: {'role:SuperAdmin': true, 'role:Admin': true},
          delete: {'role:SuperAdmin': true, 'role:Admin': true},
          protectedFields: {},
        },
      },
      ...classNames.map(className => {
        console.log(classNames);
        const classConstructor = Parse.Object.extend(className);
        return getSchemaDefinition(
          classConstructor,
          publicClassNames.includes(className)
        );
      }),
    ],
    lockSchemas: false,
    strict: true,
    recreateModifiedFields: false,
    deleteExtraFields: false,
  },
};

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  auth: {
    user: process.env.SENDERMAIL,
    pass: process.env.MAILPASSWORD,
  },
});

// Initialize Parse Server
async function initializeParseServer() {
  const parseServer = new ParseServer(parseConfig);
  await parseServer.start();
  return parseServer;
}

function validateFunctionRoutes(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const functionName = req.path.split('/')[1];
  const metadata = CloudFunctionRegistry.getFunction(functionName);
  console.log(functionName);
  if (!metadata) {
    return res.status(404).json({message: 'Function not found'});
  }

  if (!metadata.config.methods.includes(req.method as HttpMethod)) {
    return res.status(405).json({message: 'Method not allowed'});
  }

  req.method = 'POST';

  return next();
}

function extractMasterKey(
  req: any,
  res: Response,
  buf: Buffer,
  encoding: BufferEncoding
) {
  try {
    const body = JSON.parse(buf.toString(encoding));
    if (body && (body.masterKey || body._MasterKey)) {
      req['x-master-key'] = body.masterKey || body._MasterKey;
    }
  } catch (err) {
    throw res.status(400).json({message: `Error parsing JSON body`});
  }
}
function restrictRoutes(req: any, res: Response, next: NextFunction) {
  const allowedRoutes = [
    '/functions',
    '/health',
    '/serverInfo',
    '/files',
    '/classes',
  ];

  if (req['x-master-key'] === process.env.masterKey) {
    return next();
  }

  if (!allowedRoutes.some(route => req.path.startsWith(route))) {
    console.log(allowedRoutes);
    console.log(req.path);
    throw res.status(403).json({message: `Route not allowed`});
  }

  next();
}

function conditionalJsonMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.path.startsWith(`${process.env.mountPath}/files`)) {
    console.log('Skipping JSON middleware for /files route');
    return next();
  }

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    console.log('Skipping JSON middleware for multipart request');
    return next();
  }

  express.json({
    limit: '10mb',
    type: ['text/plain'],
    verify: extractMasterKey,
  })(req, res, next);
}

function removeResultMiddleware(req: any, res: any, next: any) {
  console.log(req.path);
  if (req.path.startsWith('/api/functions')) {
    const originalSend = res.send;
    res.send = function (body: any) {
      try {
        let modifiedBody = typeof body === 'string' ? JSON.parse(body) : body;
        if (modifiedBody && modifiedBody.result !== undefined) {
          modifiedBody = modifiedBody.result;
        }
        originalSend.call(this, JSON.stringify(modifiedBody));
      } catch (err) {
        console.error('Error processing response in middleware:', err);
        originalSend.call(this, body);
      }
    };
  }

  next();
}

async function main() {
  const parseServer = await initializeParseServer();
  Parse.masterKey = process.env.masterKey;

  app.use(removeResultMiddleware);
  app.use(cors());
  app.use(process.env.mountPath + '/functions', validateFunctionRoutes as any);
  app.use(conditionalJsonMiddleware);
  app.use(`${process.env.mountPath}`, restrictRoutes);
  app.use(process.env.mountPath as string, parseServer.app);
  CloudFunctionRegistry.initialize();

  const registeredFunctions = CloudFunctionRegistry.getFunctions();
  console.log('\n ============ Registered Cloud Functions ============');
  registeredFunctions.forEach(fn => {
    console.log(`   ${fn.name} [${fn.config.methods.join(', ')}]`);
  });
  console.log(` Total: ${registeredFunctions.length} functions registered\n`);

  server.listen(1337, () => {
    seedAll();
    console.log('The Server is up and running on port 1337.');
  });

  try {
    await ParseServer.createLiveQueryServer(server);
    console.log(' Live Query Server started successfully');

    server.on('upgrade', (request: any, socket: any, head: any) => {
      console.log(' WebSocket upgrade request:', request.url);
    });
  } catch (error) {
    console.error(' Error starting Live Query Server:', error);
  }
}

main()
  .then(() => {
    console.log('--- Server Initialized ---');
  })
  .catch(error => {
    return console.error('Error starting the server:', error);
  });
