import * as grpc from 'grpc';
import path from 'path';

let protoLoader = require('@grpc/proto-loader');

export default class Authentication {
  private readonly client: any;

  constructor(url: string) {
    var packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, '../../proto/authentication.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    var authentication = protoDescriptor.authentication.Authentication;
    this.client = new authentication(url, grpc.credentials.createInsecure());
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig({newConfig: JSON.stringify(newConfig)},
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        })
    });
  }
}
