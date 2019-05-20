
export interface EthereumNodeOptions {
  blockRetention: number;
  connectionTimeout: number;
  http: string | null;
  pollingIntervalMilliseconds: number;
  ws: string | null;
}

export interface EnvObject {
  "augur-node": string;
  "ethereum-node": EthereumNodeOptions;
  universe: string | null;
  useWeb3Transport: boolean;
}

export interface Connection {
  isConnected: boolean;
  isConnectedToAugurNode: boolean;
  augurNodeNetworkId: string;
  isReconnectionPaused: boolean;
}

export interface Category {
  categoryName: string;
  nonFinalizedOpenInterest: string;
  openInterest: string;
  tags: Array<string>;
}

export interface Blockchain {
  currentBlockNumber: number;
  currentAugurTimestamp: number;
  highestBlock: number;
  lastProcessedBlock: number;
}

export interface AppStatus {
  isLogged: boolean|undefined;
  edgeLoading: boolean|undefined;
  edgeContext: string|undefined;
  isConnectionTrayOpen: boolean|undefined;
}

export interface PositionData {
  marketId: string;
  netPosition: string;
  outcome: string;
  position: string;
  averagePrice: string;
  realized: string;
  timestamp: number;
  total: string;
  unrealized: string;
  cost: string;
  unrealizedCost: string;
  unrealizedRevenue: string;
  totalPercent: string;
  unrealizedPercent: string;
  realizedPercent: string;
  unrealizedRevenue24hChangePercent: string;
}

export interface AccountPosition {
  marketId: string | null;
  positionData: PositionData;
}

export interface UnrealizedRevenue {
  unrealizedRevenue24hChangePercent: string;
}

export interface LoginAccount {
  address: string;
  displayAddress: string;
  meta: { accontType: string; address: string; signer: object | null };
  totalFrozenFunds: string;
  tradingPositionsTotal: UnrealizedRevenue;
  eth: string;
  rep: string;
  dai: string;
}

export interface BaseAction {
  type: string;
  data: any | undefined;
}