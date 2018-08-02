/* eslint react/no-array-index-key: 0 */ // It's OK in this specific instance as order remains the same

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { augur } from 'services/augurjs'

import CreateMarketDefine from 'modules/create-market/components/create-market-form-define/create-market-form-define'
import CreateMarketOutcome from 'modules/create-market/components/create-market-form-outcome/create-market-form-outcome'
import CreateMarketResolution from 'modules/create-market/components/create-market-form-resolution/create-market-form-resolution'
import CreateMarketLiquidity from 'modules/create-market/components/create-market-form-liquidity/create-market-form-liquidity'
import CreateMarketLiquidityOrders from 'modules/create-market/components/create-market-form-liquidity-orders/create-market-form-liquidity-orders'
import CreateMarketReview from 'modules/create-market/components/create-market-form-review/create-market-form-review'
import Styles from 'modules/create-market/components/create-market-form/create-market-form.styles'
import { ExclamationCircle as InputErrorIcon } from 'modules/common/components/icons'
import { createBigNumber } from 'utils/create-big-number'
import { CATEGORICAL, SCALAR } from 'modules/markets/constants/market-types'
import { BID } from 'modules/transactions/constants/types'

const NEW_ORDER_GAS_ESTIMATE = createBigNumber(700000)

export default class CreateMarketForm extends Component {

  static propTypes = {
    addOrderToNewMarket: PropTypes.func.isRequired,
    availableEth: PropTypes.string.isRequired,
    availableRep: PropTypes.string.isRequired,
    categories: PropTypes.array.isRequired,
    currentTimestamp: PropTypes.number.isRequired,
    history: PropTypes.object.isRequired,
    isMobileSmall: PropTypes.bool.isRequired,
    meta: PropTypes.object,
    newMarket: PropTypes.object.isRequired,
    removeOrderFromNewMarket: PropTypes.func.isRequired,
    submitNewMarket: PropTypes.func.isRequired,
    universe: PropTypes.object.isRequired,
    estimateSubmitNewMarket: PropTypes.func.isRequired,
    updateNewMarket: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props)

    this.state = {
      pages: ['Define', 'Outcome', 'Resolution', 'Liquidity', 'Review'],
      liquidityState: {},
      awaitingSignature: false,
      insufficientFunds: true,
    }

    this.prevPage = this.prevPage.bind(this)
    this.nextPage = this.nextPage.bind(this)
    this.validateField = this.validateField.bind(this)
    this.validateNumber = this.validateNumber.bind(this)
    this.isValid = this.isValid.bind(this)
    this.keyPressed = this.keyPressed.bind(this)
    this.updateState = this.updateState.bind(this)
    this.updateStateValue = this.updateStateValue.bind(this)
    this.updateInitialLiquidityCosts = this.updateInitialLiquidityCosts.bind(this)
    this.handleCancelOrder = this.handleCancelOrder.bind(this)
  }

  componentWillReceiveProps(nextProps) {
    const {
      newMarket,
      updateNewMarket,
    } = this.props
    if (newMarket.currentStep !== nextProps.newMarket.currentStep && nextProps.newMarket.currentStep !== 4) {
      updateNewMarket({ isValid: this.isValid(nextProps.newMarket.currentStep) })
    }
  }

  prevPage() {
    const {
      newMarket,
      updateNewMarket,
    } = this.props
    const newStep = newMarket.currentStep <= 0 ? 0 : newMarket.currentStep - 1
    updateNewMarket({ currentStep: newStep })
  }

  nextPage() {
    const {
      newMarket,
      updateNewMarket,
    } = this.props
    if (newMarket.isValid) {
      const newStep = newMarket.currentStep >= (this.state.pages.length - 1) ? this.state.pages.length - 1 : newMarket.currentStep + 1
      updateNewMarket({ currentStep: newStep })
    }
  }

  keyPressed(event) {
    if (event.key === 'Enter') {
      this.nextPage()
    }
  }

  updateState(newState) {
    this.setState(newState)
  }

  updateStateValue(property, value) {
    this.setState({ [property]: value })
  }

  validateField(fieldName, value, maxLength) {
    const {
      newMarket,
      updateNewMarket,
    } = this.props
    const { currentStep } = newMarket

    const updatedMarket = { ...newMarket }

    switch (true) {
      case typeof value === 'string' && !value.trim().length:
        updatedMarket.validations[currentStep][fieldName] = 'This field is required.'
        break
      case maxLength && value.length > maxLength:
        updatedMarket.validations[currentStep][fieldName] = `Maximum length is ${maxLength}.`
        break
      default:
        updatedMarket.validations[currentStep][fieldName] = true
    }

    updatedMarket[fieldName] = value
    updatedMarket.isValid = this.isValid(currentStep)

    updateNewMarket(updatedMarket)
  }

  validateNumber(
    fieldName,
    rawValue,
    humanName,
    min,
    max,
    decimals = 0,
    leadingZero = false,
  ) {
    const {
      newMarket,
      updateNewMarket,
    } = this.props
    const updatedMarket = { ...newMarket }
    const { currentStep } = newMarket

    let value = rawValue

    const regExp = new RegExp('^[0-9]+\\.[0]{0,' + decimals + '}$')
    if (value !== '' && !regExp.test(value)) {
      value = parseFloat(value)
      value = parseFloat(value.toFixed(decimals))
    }

    switch (true) {
      case value === '':
        updatedMarket.validations[currentStep][fieldName] = `The ${humanName} field is required.`
        break
      case (value > max || value < min):
        updatedMarket.validations[currentStep][fieldName] = `${humanName}`.charAt(0).toUpperCase()
        updatedMarket.validations[currentStep][fieldName] += `${humanName} must be between ${min} and ${max}.`.slice(1)
        break
      default:
        updatedMarket.validations[currentStep][fieldName] = true
        break
    }

    if (leadingZero && value < 10) {
      value = `0${value}`
    }

    updatedMarket[fieldName] = typeof value === 'number' ? value.toString() : value
    updatedMarket.isValid = this.isValid(currentStep)

    updateNewMarket(updatedMarket)
  }

  isValid(currentStep) {
    const { newMarket } = this.props
    const validations = newMarket.validations[currentStep]
    const validationsArray = Object.keys(validations)
    return validationsArray.every(key => validations[key] === true)
  }

  updateInitialLiquidityCosts(order, shouldReduce) {
    const {
      availableEth,
      newMarket,
      updateNewMarket,
    } = this.props
    const minPrice = newMarket.type === SCALAR ? newMarket.scalarSmallNum : 0
    const maxPrice = newMarket.type === SCALAR ? newMarket.scalarBigNum : 1
    const shareBalances = newMarket.outcomes.map(outcome => 0)
    let outcome
    let initialLiquidityEth
    let initialLiquidityGas

    switch (newMarket.type) {
      case CATEGORICAL:
        newMarket.outcomes.forEach((outcomeName, index) => {
          if (this.state.selectedOutcome === outcomeName) outcome = index
        })
        break
      case SCALAR:
        outcome = this.state.selectedOutcome
        break
      default:
        outcome = 1
    }

    const orderInfo = {
      orderType: order.type === BID ? 0 : 1,
      outcome,
      shares: order.quantity,
      price: order.price,
      tokenBalance: availableEth,
      minPrice,
      maxPrice,
      marketCreatorFeeRate: newMarket.settlementFee,
      reportingFeeRate: 0,
      shareBalances,
      singleOutcomeOrderBook: newMarket.orderBook[outcome] || {},
    }
    const action = augur.trading.simulateTrade(orderInfo)
    // NOTE: Fees are going to always be 0 because we are only opening orders, and there is no costs associated with opening orders other than the escrowed ETH and the gas to put the order up.
    if (shouldReduce) {
      initialLiquidityEth = newMarket.initialLiquidityEth.minus(action.tokensDepleted)
      initialLiquidityGas = newMarket.initialLiquidityGas.minus(NEW_ORDER_GAS_ESTIMATE)
    } else {
      initialLiquidityEth = newMarket.initialLiquidityEth.plus(action.tokensDepleted)
      initialLiquidityGas = newMarket.initialLiquidityGas.plus(NEW_ORDER_GAS_ESTIMATE)
    }

    updateNewMarket({ initialLiquidityEth, initialLiquidityGas })
  }

  handleCancelOrder(orderDetails) {
    const {
      newMarket,
      removeOrderFromNewMarket,
    } = this.props
    const order = newMarket.orderBook[orderDetails.outcome][orderDetails.index]
    this.updateInitialLiquidityCosts(order, true)
    removeOrderFromNewMarket(orderDetails)
  }

  render() {
    const {
      addOrderToNewMarket,
      availableEth,
      availableRep,
      categories,
      currentTimestamp,
      history,
      isMobileSmall,
      meta,
      newMarket,
      submitNewMarket,
      universe,
      updateNewMarket,
      estimateSubmitNewMarket,
    } = this.props
    const s = this.state

    // TODO -- refactor this to derive route based on url path rather than state value
    //  (react-router-dom declarative routing)

    return (
      <article className={Styles.CreateMarketForm}>
        <div className={Styles['CreateMarketForm__form-outer-wrapper']}>
          <div className={Styles['CreateMarketForm__form-inner-wrapper']}>
            { newMarket.currentStep === 0 &&
              <CreateMarketDefine
                newMarket={newMarket}
                updateNewMarket={updateNewMarket}
                validateField={this.validateField}
                categories={categories}
                isValid={this.isValid}
                keyPressed={this.keyPressed}
              />
            }
            { newMarket.currentStep === 1 &&
              <CreateMarketOutcome
                newMarket={newMarket}
                updateNewMarket={updateNewMarket}
                validateField={this.validateField}
                isValid={this.isValid}
                isMobileSmall={isMobileSmall}
                keyPressed={this.keyPressed}
              />
            }
            { newMarket.currentStep === 2 &&
              <CreateMarketResolution
                newMarket={newMarket}
                updateNewMarket={updateNewMarket}
                validateField={this.validateField}
                validateNumber={this.validateNumber}
                isValid={this.isValid}
                isMobileSmall={isMobileSmall}
                currentTimestamp={currentTimestamp}
                keyPressed={this.keyPressed}
              />
            }
            { newMarket.currentStep === 3 &&
              <CreateMarketLiquidity
                newMarket={newMarket}
                updateNewMarket={updateNewMarket}
                validateNumber={this.validateNumber}
                addOrderToNewMarket={addOrderToNewMarket}
                updateInitialLiquidityCosts={this.updateInitialLiquidityCosts}
                availableEth={availableEth}
                isMobileSmall={isMobileSmall}
                keyPressed={this.keyPressed}
                liquidityState={s.liquidityState}
                updateState={this.updateState}
              />
            }
            { newMarket.currentStep === 4 &&
              <CreateMarketReview
                estimateSubmitNewMarket={estimateSubmitNewMarket}
                meta={meta}
                newMarket={newMarket}
                availableEth={availableEth}
                availableRep={availableRep}
                universe={universe}
                updateStateValue={this.updateStateValue}
                keyPressed={this.keyPressed}
              />
            }
          </div>
          <div className={Styles['CreateMarketForm__button-outer-wrapper']}>
            <div className={Styles['CreateMarketForm__button-inner-wrapper']}>
              <div className={Styles.CreateMarketForm__navigation}>
                <button
                  className={classNames(Styles.CreateMarketForm__prev, { [`${Styles['hide-button']}`]: newMarket.currentStep === 0 })}
                  onClick={this.prevPage}
                >Previous: {s.pages[newMarket.currentStep - 1]}
                </button>
                { newMarket.currentStep < 4 &&
                  <button
                    className={classNames(Styles.CreateMarketForm__next, { [`${Styles['hide-button']}`]: newMarket.currentStep === s.pages.length - 1 })}
                    disabled={!newMarket.isValid}
                    onClick={this.nextPage}
                  >Next: {s.pages[newMarket.currentStep + 1]}
                  </button>
                }
                { newMarket.currentStep === 4 &&
                  <button
                    className={Styles.CreateMarketForm__submit}
                    disabled={s.insufficientFunds || s.awaitingSignature}
                    onClick={(e) => {
                      this.setState({ awaitingSignature: true }, () => {
                        submitNewMarket(newMarket, history, (err, market) => {
                          if (err) this.setState({ awaitingSignature: false })
                        })
                      })
                    }}
                  >Submit
                  </button>
                }
              </div>
            </div>
          </div>
          { newMarket.currentStep === 3 &&
            <CreateMarketLiquidityOrders
              newMarket={newMarket}
              removeOrderFromNewMarket={this.handleCancelOrder}
              liquidityState={s.liquidityState}
            />
          }
          { newMarket.currentStep === 4 && s.awaitingSignature &&
            <div className={Styles['CreateMarketForm__submit-wrapper']}>
              <div className={Styles.CreateMarketForm__submitWarning}>
                {InputErrorIcon} Please sign transaction(s) to complete market creation.
              </div>
            </div>
          }
        </div>
      </article>
    )
  }
}
