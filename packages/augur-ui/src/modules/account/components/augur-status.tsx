import React from "react";

import BlockStatus from "modules/account/components/block-status";
import SyncStatus from "modules/account/components/sync-status";
import Activity from "modules/account/containers/activity";
import QuadBox from "modules/portfolio/components/common/quad-box";
import { AUGUR_STATUS_TITLE } from "modules/common/constants";

import Styles from "modules/account/components/status.styles.less";

export interface SyncingInfo {
  percent: number;
  blocksBehind: number;
  highestBlockBn: number;
  lastProcessedBlockBn: number;
}

export interface AugurStatusProps {
  syncingInfo?: SyncingInfo;
}

const AugurStatus = ({ syncingInfo }: AugurStatusProps) => {
  if (!syncingInfo) {
    return null;
  }

  const {
    percent,
    blocksBehind,
    highestBlockBn,
    lastProcessedBlockBn,
  } = syncingInfo;

  return (
    <QuadBox
      title={AUGUR_STATUS_TITLE}
      content={
        <div className={Styles.AugurStatusContent}>
          <SyncStatus syncPercent={percent} />
          <BlockStatus
            blocksBehind={blocksBehind}
            highestBlockBn={highestBlockBn}
            lastProcessedBlockBn={lastProcessedBlockBn}
          />
          <Activity />
        </div>
      }
    />
  );
};

export default AugurStatus;
