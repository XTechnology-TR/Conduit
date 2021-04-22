import ConduitGrpcSdk, { GrpcServer, RouterResponse, RouterRequest } from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { isNil } from 'lodash';
import { ServiceAdmin } from './service';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';

let paths = require('./admin.json').functions;
export class AdminHandlers {
  private database: any;

  constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
    let serviceAdmin = new ServiceAdmin(this.grpcSdk);
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        getUsers: this.getUsers.bind(this),
        createUser: this.createUser.bind(this),
        deleteUser: this.deleteUser.bind(this),
        blockUser: this.blockUser.bind(this),
        unblockUser: this.unblockUser.bind(this),
        getServices: serviceAdmin.getServices.bind(serviceAdmin),
        createService: serviceAdmin.createService.bind(serviceAdmin),
        renewServiceToken: serviceAdmin.renewToken.bind(serviceAdmin),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async getUsers(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const usersPromise = this.database.findMany(
      'User',
      {},
      null,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments('User', {});

    let errorMessage: string | null = null;
    const [users, count] = await Promise.all([usersPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ users, count }) });
  }

  async createUser(call: RouterRequest, callback: RouterResponse) {
    let { identification, password } = JSON.parse(call.request.params);

    if (isNil(identification) || isNil(password)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'identification and password are required' });
    }

    const config = ConfigController.getInstance().config;
    if (config.local.identifier === 'email') {
      if (identification.indexOf('+') !== -1) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Email contains unsupported characters',
        });
      }

      identification = identification.toLowerCase();
    }

    let errorMessage = null;
    let user = await this.database
      .findOne('User', { email: identification })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (!isNil(user)) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: 'User already exists',
      });
    }

    AuthUtils.hashPassword(password)
      .then((hashedPassword: string) => {
        const isVerified = true;
        return this.database.create('User', { email: identification, hashedPassword, isVerified });
      })
      .then(() => {
        callback(null, {
          result: JSON.stringify({ message: 'Registration was successful' })
        });
      })
      .catch((e: any) => {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      });
  }

  async deleteUser(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);

    if (isNil(id)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }

    let errorMessage: string | null = null;
    let user = await this.database
      .findOne('User', { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(user)) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: 'User does not exist',
      });
    }

    this.database.deleteOne('User', { _id: id })
      .then(() => {
        callback(null, { result: JSON.stringify({ message: 'user was deleted'})});
      })
      .catch((e: Error) => {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      });
  }

  async blockUser(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);

    if (isNil(id)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }

    let errorMessage: string | null = null;
    const user = await this.database.findOne('User', { _id: id })
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(user)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'user does not exist' });
    }

    if (!user.active) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'user is already blocked' });
    }

    user.active = false;
    this.database.findByIdAndUpdate('User', user._id, user)
      .then(() => {
        callback(null, { result: JSON.stringify({ message: 'user was blocked' })});
      })
      .catch((e: Error) => {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      });
  }

  async unblockUser(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);

    if (isNil(id)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }

    let errorMessage: string | null = null;
    const user = await this.database.findOne('User', { _id: id })
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(user)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'user does not exist' });
    }

    if (user.active) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'user is not blocked' });
    }

    user.active = true;
    this.database.findByIdAndUpdate('User', user._id, user)
      .then(() => {
        callback(null, { result: JSON.stringify({ message: 'user was unblocked' })});
      })
      .catch((e: Error) => {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      });
  }
}
