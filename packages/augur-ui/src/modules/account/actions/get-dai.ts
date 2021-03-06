import { updateAlert } from "modules/alerts/actions/alerts";
import { updateAssets } from "modules/auth/actions/update-assets";
import { selectCurrentTimestampInSeconds as getTime } from "store/select-state";
import { CONFIRMED, FAILED } from "modules/common/constants";
import logError from "utils/log-error";
import { getDai } from "modules/contracts/actions/contractCalls";
import { AppState } from "store";
import { Action } from "redux";
import { ThunkDispatch } from "redux-thunk";
import { NodeStyleCallback } from "modules/types";

export default function(callback: NodeStyleCallback = logError) {
  return async (dispatch: ThunkDispatch<void, any, Action>, getState: () => AppState) => {
    const update = (id: string, status: string) =>
      dispatch(
        updateAlert(id, {
          id,
          status,
          timestamp: getTime(getState()),
        }),
      );
    // TODO: this will change when pending tx exists
    await getDai().catch((err: Error) => {
      console.log("error could not get dai", err);
      update("get-Dai", FAILED);
      logError(new Error("get-Dai"));
    });
    // TODO: this will change when pending tx exists
    update("get-Dai", CONFIRMED);
    dispatch(updateAssets());
    callback(null);
  };
}
