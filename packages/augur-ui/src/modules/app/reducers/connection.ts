import { Connection, BaseAction } from "modules/types";
import {
  UPDATE_CONNECTION_STATUS,
  UPDATE_AUGUR_NODE_CONNECTION_STATUS,
  UPDATE_IS_RECONNECTION_PAUSED,
  UPDATE_AUGUR_NODE_NETWORK_ID
} from "modules/app/actions/update-connection";
import { RESET_STATE } from "modules/app/actions/reset-state";

const DEFAULT_STATE: Connection = {
  isConnected: false,
  isConnectedToAugurNode: false,
  augurNodeNetworkId: null,
  isReconnectionPaused: false
};

export default function(
  connection: Connection = DEFAULT_STATE,
  action: BaseAction,
) {
  switch (action.type) {
    case UPDATE_CONNECTION_STATUS: {
      const { isConnected } = action.data;
      return {
        ...connection,
        isConnected
      };
    }
    case UPDATE_AUGUR_NODE_CONNECTION_STATUS: {
      const { isConnectedToAugurNode } = action.data;
      return {
        ...connection,
        isConnectedToAugurNode
      };
    }
    case UPDATE_AUGUR_NODE_NETWORK_ID: {
      const { augurNodeNetworkId } = action.data;
      return {
        ...connection,
        augurNodeNetworkId
      };
    }
    case UPDATE_IS_RECONNECTION_PAUSED: {
      const { isReconnectionPaused } = action.data;
      return {
        ...connection,
        isReconnectionPaused
      };
    }
    case RESET_STATE:
      return DEFAULT_STATE;
    default:
      return connection;
  }
}