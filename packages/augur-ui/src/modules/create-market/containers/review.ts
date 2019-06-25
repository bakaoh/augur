import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { submitNewMarket } from "modules/markets/actions/submit-new-market";
import {
  addOrderToNewMarket,
  removeOrderFromNewMarket,
  updateNewMarket
} from "modules/markets/actions/update-new-market";
import Review from "modules/create-market/components/review";
import { selectCurrentTimestamp } from "select-state";
import getValue from "utils/get-value";

const mapStateToProps = state => ({
  newMarket: state.newMarket,
  currentTimestamp: selectCurrentTimestamp(state),
  address: getValue(state, "loginAccount.address"),
});

const mapDispatchToProps = dispatch => ({
  updateNewMarket: data => dispatch(updateNewMarket(data)),
  submitNewMarket: (data, history, cb) =>
    dispatch(submitNewMarket(data, history, cb)),
});

const ReviewContainer = withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Review)
);

export default ReviewContainer;