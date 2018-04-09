import * as Knex from "knex";
import { Address, ReportingState, AsyncCallback } from "../../types";
import { BigNumber } from "bignumber.js";

function queryCurrentMarketStateId(db: Knex, marketId: Address) {
  return db("market_state").max("marketStateId as latestMarketStateId").first().where({ marketId });
}

function setMarketStateToLatest(db: Knex, marketId: Address, callback: AsyncCallback) {
  db("markets").update({
    marketStateId: queryCurrentMarketStateId(db, marketId),
  }).where({ marketId }).asCallback(callback);
}

export function updateMarketState(db: Knex, marketId: Address, blockNumber: number, reportingState: ReportingState , callback: AsyncCallback) {
  const marketStateDataToInsert = { marketId, reportingState, blockNumber };
  db.insert(marketStateDataToInsert).into("market_state").asCallback((err: Error|null, marketStateId?: Array<number>): void => {
    if (err) return callback(err);
    if (!marketStateId || !marketStateId.length) return callback(new Error("Failed to generate new marketStateId for marketId:" + marketId));

    setMarketStateToLatest(db, marketId, callback);
  });
}

export function rollbackMarketState(db: Knex, marketId: Address, expectedState: ReportingState, callback: AsyncCallback): void {
  db("market_state").delete().where({
    marketStateId: queryCurrentMarketStateId(db, marketId),
    reportingState: expectedState,
  }).asCallback((err: Error|null, rowsAffected: number) => {
    if (rowsAffected === 0) return callback(new Error(`Unable to rollback market "${marketId}" from reporting state "${expectedState}" because it is not the most current state`));

    setMarketStateToLatest(db, marketId, callback);
  });
}

export function insertPayout(db: Knex, marketId: Address, payoutNumerators: Array<string|number|null>, invalid: boolean, tentativeWinning: boolean, callback: (err: Error|null, payoutId?: number) => void): void {
  const payoutRow: { [index: string]: string|number|boolean|null } = {
    marketId,
    isInvalid: invalid,
  };
  payoutNumerators.forEach((value, i): void => {
    if (value == null) return;
    payoutRow["payout" + i] = new BigNumber(value, 10).toFixed();
  });
  db.select("payoutId").from("payouts").where(payoutRow).first().asCallback( (err: Error|null, payoutIdRow?: {payoutId: number}|null): void => {
    if (err) return callback(err);
    if (payoutIdRow != null) {
      return callback(null, payoutIdRow.payoutId);
    } else {
      const payoutRowWithTentativeWinning = Object.assign( {},
        payoutRow,
        {tentativeWinning},
        );
      db.insert(payoutRowWithTentativeWinning).into("payouts").asCallback((err: Error|null, payoutIdRow?: Array<number>): void => {
        if (err) callback(err);
        if (!payoutIdRow || !payoutIdRow.length) return callback(new Error("No payoutId returned"));
        callback(err, payoutIdRow[0]);
      });
    }
  });
}
