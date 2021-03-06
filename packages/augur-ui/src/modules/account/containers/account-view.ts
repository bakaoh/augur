import { connect } from "react-redux";
import { withRouter } from "react-router-dom";

import { selectNotifications } from "modules/notifications/selectors/notification-state";
import AccountView from "modules/account/components/account-view";
import { AppState } from "store";

const mapStateToProps = (state: AppState) => {
  const notifications = selectNotifications(state);

  return {
    newNotifications:
      notifications &&
      notifications.filter((notification: any) => notification.isNew).length > 0,
  };
};

const AccountViewContainer = withRouter(connect(mapStateToProps)(AccountView));

export default AccountViewContainer;
