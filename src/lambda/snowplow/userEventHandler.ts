import { buildSelfDescribingEvent } from '@snowplow/node-tracker';
import { SelfDescribingJson } from '@snowplow/tracker-core';
import { EventType, SnowplowEventMap, UserEventPayloadSnowplow } from './types';
import { Account, ApiUser, ObjectUpdate, User } from './types';
import config from '../config';
import { EventHandler } from '../eventConsumer/EventHandler';
import { tracker } from './tracker';

type ObjectUpdateEvent = Omit<SelfDescribingJson, 'data'> & {
  data: ObjectUpdate;
};

type AccountContext = Omit<SelfDescribingJson, 'data'> & {
  data: Account;
};

type UserContext = Omit<SelfDescribingJson, 'data'> & {
  data: User;
};

type ApiUserContext = Omit<SelfDescribingJson, 'data'> & {
  data: ApiUser;
};

/**
 * This class MUST be initialized using the SnowplowHandler.init() method.
 * This is done to ensure event handlers adhere to the EventHandlerInterface.
 */
export class UserEventHandler extends EventHandler {
  constructor() {
    super(tracker);
    return this;
  }

  /**
   * method to create and process event data
   * @param data
   */
  async process(data: UserEventPayloadSnowplow): Promise<void> {
    this.addRequestInfoToTracker(data);
    const event = buildSelfDescribingEvent({
      event: UserEventHandler.generateAccountUpdateEvent(data),
    });
    const context = await UserEventHandler.generateEventContext(data);
    await super.track(event, context);
  }

  /**
   * @private
   */
  private static generateAccountUpdateEvent(
    data: UserEventPayloadSnowplow
  ): ObjectUpdateEvent {
    return {
      schema: config.snowplow.schemas.objectUpdate,
      data: {
        trigger: SnowplowEventMap[data.eventType],
        object: 'account',
      },
    };
  }

  /**
   * @private to build event context for ACCOUNT_DELETE event.
   */
  private static generateDeleteEventAccountContext(
    data: UserEventPayloadSnowplow
  ): AccountContext {
    return {
      schema: config.snowplow.schemas.account,
      data: {
        object_version: 'new',
        user_id: parseInt(data.user.id),
      },
    };
  }

  private static generateAccountContext(
    data: UserEventPayloadSnowplow
  ): AccountContext {
    return {
      schema: config.snowplow.schemas.account,
      data: {
        object_version: 'new',
        user_id: parseInt(data.user.id),
        emails: [data.user.email],
      },
    };
  }

  private static async generateEventContext(
    data: UserEventPayloadSnowplow
  ): Promise<SelfDescribingJson[]> {
    const context = [
      UserEventHandler.generateUserContext(data),
      UserEventHandler.generateApiUserContext(data),
    ];

    data.eventType == EventType.ACCOUNT_DELETE
      ? context.push(UserEventHandler.generateDeleteEventAccountContext(data))
      : context.push(UserEventHandler.generateAccountContext(data));
    return context;
  }

  private static generateUserContext(
    data: UserEventPayloadSnowplow
  ): UserContext {
    return {
      schema: config.snowplow.schemas.user,
      data: {
        email: data.user.email,
        guid: data.user.guid,
        hashed_guid: data.user.hashedGuid,
        user_id: parseInt(data.user.id),
        hashed_user_id: data.user.hashedId,
      },
    };
  }

  private static generateApiUserContext(
    data: UserEventPayloadSnowplow
  ): ApiUserContext {
    return {
      schema: config.snowplow.schemas.apiUser,
      data: {
        api_id: parseInt(data.apiUser.apiId),
        name: data.apiUser.name,
        is_native: data.apiUser.isNative,
        is_trusted: data.apiUser.isTrusted,
        client_version: data.apiUser.clientVersion,
      },
    };
  }

  /**
   * Updates tracker with request information
   * @private
   */
  private addRequestInfoToTracker(data: UserEventPayloadSnowplow) {
    this.tracker.setLang(data.request?.language);
    this.tracker.setDomainUserId(data.request?.snowplowDomainUserId); // possibly grab from cookie else grab from context
    this.tracker.setIpAddress(data.request?.ipAddress); // get the remote address from teh x-forwarded-for header
    this.tracker.setUseragent(data.request?.userAgent);
  }
}
