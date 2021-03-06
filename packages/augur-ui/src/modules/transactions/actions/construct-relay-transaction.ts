import { constructBasicTransaction } from "modules/transactions/actions/construct-transaction";
import unpackTransactionParameters from "modules/transactions/helpers/unpack-transaction-parameters";
import { addAlert } from "modules/alerts/actions/alerts";
import { selectCurrentTimestampInSeconds } from "store/select-state";

import makePath from "modules/routes/helpers/make-path";

import { TRANSACTIONS } from "modules/routes/constants/views";
import { ThunkDispatch } from "redux-thunk";
import { Action } from "redux";
import { AppState } from "store";

export const constructRelayTransaction = (tx: any) => (
  dispatch: ThunkDispatch<void, any, Action>,
  getState: () => AppState,
) => {
  const { alerts } = getState();
  const { hash, status } = tx;
  const unpackedParams = unpackTransactionParameters(tx);
  const timestamp =
    tx.response.timestamp || selectCurrentTimestampInSeconds(getState());
  const blockNumber =
    tx.response.blockNumber && parseInt(tx.response.blockNumber, 16);
  if (!alerts.filter((alert: any) => alert.id === hash).length) {
    dispatch(
      addAlert({
        id: hash,
        timestamp,
        blockNumber,
        params: unpackedParams,
        status,
        // @ts-ignore
        title: unpackedParams.type,
        description: "",
        linkPath: makePath(TRANSACTIONS, false),
        to: tx.data.to,
      }),
    );
  }
  return {
    [hash]: constructBasicTransaction({
      // @ts-ignore
      eventName: unpackedParams.type,
      hash,
      blockNumber,
      timestamp,
      message: "",
      // @ts-ignore
      description: unpackedParams._description || "",
      gasFees: tx.response.gasFees,
      status,
    }),
  };
};
