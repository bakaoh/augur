import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { GAS_SPEED_LABELS } from "modules/common/constants";
import { updateModal } from "modules/modal/actions/update-modal";
import GasPriceEdit from "modules/app/components/gas-price-edit";
import { AppState } from "store";
import { ThunkDispatch } from "redux-thunk";
import { Action } from "redux";

const mapStateToProps = (state: AppState) => {
  const { fast, average, safeLow, userDefinedGasPrice } = state.gasPriceInfo;

  const userDefined = userDefinedGasPrice || average || 0;
  let gasPriceSpeed = GAS_SPEED_LABELS.STANDARD;
  if (userDefined > fast && fast !== 0) {
    gasPriceSpeed = GAS_SPEED_LABELS.FAST;
  } else if (userDefined < safeLow && safeLow !== 0) {
    gasPriceSpeed = GAS_SPEED_LABELS.SLOW;
  }

  return {
    modal: state.modal,
    userDefinedGasPrice: userDefined,
    gasPriceSpeed
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<void, any, Action>) => ({
  updateModal: (modal: any) => dispatch(updateModal(modal))
});

export default withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(GasPriceEdit)
);
