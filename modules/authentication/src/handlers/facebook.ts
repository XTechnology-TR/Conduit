import request, { OptionsWithUrl } from 'request-promise';
import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  RouterRequest,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';

export class FacebookHandlers {
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider;
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;

    if (!authConfig.facebook.enabled) {
      console.log('Facebook not active');
      throw ConduitError.forbidden('Facebook auth is deactivated');
    }
    if (!authConfig.facebook.clientId) {
      console.log('Facebook not active');
      throw ConduitError.forbidden('Cannot enable facebook auth due to missing clientId');
    }
    console.log('Facebook is active');
    this.initialized = true;
    return true;
  }

  async authenticate(call: RouterRequest) {
    if (!this.initialized)
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    const { access_token } = JSON.parse(call.request.params);

    const config = ConfigController.getInstance().config;

    const context = JSON.parse(call.request.context);
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No headers provided');

    const facebookOptions: OptionsWithUrl = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      qs: {
        access_token,
        fields: 'id,email',
      },
      json: true,
    };

    const facebookResponse = await request(facebookOptions);

    if (isNil(facebookResponse.email) || isNil(facebookResponse.id)) {
      throw new GrpcError(
        grpc.status.UNAUTHENTICATED,
        'Authentication with facebook failed'
      );
    }

    let user = await this.database.findOne('User', { email: facebookResponse.email });

    if (!isNil(user)) {
      if (!user.active)
        throw new GrpcError(grpc.status.PERMISSION_DENIED, 'Inactive user');
      if (!config.facebook.accountLinking) {
        throw new GrpcError(
          grpc.status.PERMISSION_DENIED,
          'User with this email already exists'
        );
      }
      if (isNil(user.facebook)) {
        user.facebook = {
          id: facebookResponse.id,
        };
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await this.database.findByIdAndUpdate('User', user);
      }
    } else {
      user = await this.database.create('User', {
        email: facebookResponse.email,
        facebook: {
          id: facebookResponse.id,
        },
        isVerified: true,
      });
    }

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user._id,
        clientId: context.clientId,
        config,
      }
    );

    return {
      result: JSON.stringify({
        userId: user._id.toString(),
        accessToken: (accessToken as any).token,
        refreshToken: (refreshToken as any).token,
      }),
    };
  }
}
