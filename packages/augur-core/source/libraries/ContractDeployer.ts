import { ethers } from "ethers";
import { BigNumber } from "bignumber.js";
import { exists, readFile, writeFile } from "async-file";
import { stringTo32ByteHex, resolveAll } from "./HelperFunctions";
import { CompilerOutput } from "solc";
import { DeployerConfiguration } from './DeployerConfiguration';
import {
    Augur,
    Universe,
    ReputationToken,
    LegacyReputationToken,
    TimeControlled,
    CompleteSets,
    Trade,
    CreateOrder,
    CancelOrder,
    FillOrder,
    Orders,
    ClaimTradingProceeds,
    Cash,
    ProfitLoss,
    SimulateTrade,
    ZeroXTradeToken
} from './ContractInterfaces';
import { NetworkConfiguration } from './NetworkConfiguration';
import { Contracts, ContractData } from './Contracts';
import { Dependencies } from '../libraries/GenericContractInterfaces';
import { ContractAddresses, NetworkId, setAddresses } from "@augurproject/artifacts";


export class ContractDeployer {
    private readonly configuration: DeployerConfiguration;
    private readonly contracts: Contracts;
    private readonly dependencies: Dependencies<BigNumber>
    private readonly provider: ethers.providers.JsonRpcProvider;
    private readonly signer: ethers.Signer;
    public augur: Augur|null = null;
    public universe: Universe|null = null;

    public static deployToNetwork = async (networkConfiguration: NetworkConfiguration, dependencies: Dependencies<BigNumber>, provider: ethers.providers.JsonRpcProvider,signer: ethers.Signer, deployerConfiguration: DeployerConfiguration) => {
        const compilerOutput = JSON.parse(await readFile(deployerConfiguration.contractInputPath, "utf8"));
        const contractDeployer = new ContractDeployer(deployerConfiguration, dependencies, provider, signer, compilerOutput);

        console.log(`\n\n-----------------
Deploying to: ${networkConfiguration.networkName}
    compiled contracts: ${deployerConfiguration.contractInputPath}
    contract address: ${deployerConfiguration.contractAddressesOutputPath}
    upload blocks #s: ${deployerConfiguration.uploadBlockNumbersOutputPath}
`);
        await contractDeployer.deploy();
    }

    public constructor(configuration: DeployerConfiguration, dependencies: Dependencies<BigNumber>, provider: ethers.providers.JsonRpcProvider, signer: ethers.Signer, compilerOutput: CompilerOutput) {
        this.configuration = configuration;
        this.dependencies = dependencies;
        this.provider = provider;
        this.signer = signer;
        this.contracts = new Contracts(compilerOutput);
    }

    public async getBlockNumber(): Promise<number> {
        return this.provider.getBlock('latest', false).then( (block) => block.number);
    }

    public async deploy(): Promise<ContractAddresses> {
        const blockNumber = await this.getBlockNumber();
        this.augur = await this.uploadAugur();
        await this.uploadAllContracts();

        if (this.configuration.isProduction) {
            console.log(`Registering Legacy Rep Contract at ${this.configuration.legacyRepAddress}`);
            await this.augur!.registerContract(stringTo32ByteHex("LegacyReputationToken"), this.configuration.legacyRepAddress);
            let contract = await this.contracts.get("LegacyReputationToken");
            contract.address = this.configuration.legacyRepAddress;

            console.log(`Registering Cash Contract at ${this.configuration.cashAddress}`);
            await this.augur!.registerContract(stringTo32ByteHex("Cash"), this.configuration.cashAddress);
            contract = await this.contracts.get("Cash");
            contract.address = this.configuration.cashAddress;

            console.log(`Registering Rep Price Oracle Contract at ${this.configuration.repPriceOracleAddress}`);
            await this.augur!.registerContract(stringTo32ByteHex("RepPriceOracle"), this.configuration.repPriceOracleAddress);
            contract = await this.contracts.get("RepPriceOracle");
            contract.address = this.configuration.repPriceOracleAddress;

            // Dai Vat
            console.log(`Registering Vat Contract at ${this.configuration.vatAddress}`);
            await this.augur!.registerContract(stringTo32ByteHex("DaiVat"), this.configuration.vatAddress);
            contract = await this.contracts.get("DaiVat");
            contract.address = this.configuration.vatAddress;

            // Dai Pot
            console.log(`Registering Pot Contract at ${this.configuration.potAddress}`);
            await this.augur!.registerContract(stringTo32ByteHex("DaiPot"), this.configuration.potAddress);
            contract = await this.contracts.get("DaiPot");
            contract.address = this.configuration.potAddress;

            // Dai Join
            console.log(`Registering Join Contract at ${this.configuration.joinAddress}`);
            await this.augur!.registerContract(stringTo32ByteHex("DaiJoin"), this.configuration.joinAddress);
            contract = await this.contracts.get("DaiJoin");
            contract.address = this.configuration.joinAddress;

            // Proxy Factory
            contract = await this.contracts.get("ProxyFactory");
            contract.address = this.configuration.proxyFactoryAddress;

            // Gnosis Safe
            contract = await this.contracts.get("GnosisSafe");
            contract.address = this.configuration.gnosisSafeAddress;

            // 0x Exchange
            console.log(`Registering 0x Exchange Contract at ${this.configuration.zeroXExchange}`);
            await this.augur!.registerContract(stringTo32ByteHex("ZeroXExchange"), this.configuration.zeroXExchange);
            contract = await this.contracts.get("ZeroXExchange");
            contract.address = this.configuration.zeroXExchange;
        } else {
            console.log(`Uploading Test Dai Contracts`);
            await this.uploadTestDaiContracts();

            console.log(`Uploading Gnosis Contracts`);
            await this.uploadGnosisContracts();

            console.log(`Uploading 0x Contracts`);
            await this.upload0xContracts();
        }

        await this.initializeAllContracts();

        if (!this.configuration.useNormalTime) {
            await this.resetTimeControlled();
        }

        if(this.configuration.createGenesisUniverse) {
            if (!this.configuration.isProduction) {
                console.log("Initializing legacy REP");
                await this.initializeLegacyRep();

                console.log("Initializing Cash");
                await this.initializeCash();
            }

            this.universe = await this.createGenesisUniverse();

            if (!this.configuration.isProduction) {
                console.log("Migrating from legacy REP");
                await this.migrateFromLegacyRep();
            }
        }

        if (this.configuration.writeArtifacts) {
          await this.generateUploadBlockNumberFile(blockNumber);
          await this.generateAddressMappingFile();
        }

        return this.generateCompleteAddressMapping();
    }

    private generateCompleteAddressMapping(): ContractAddresses {
        // This type assertion means that `mapping` can possibly NOT adhere to the ContractAddresses interface.
        const mapping = {} as ContractAddresses;

        mapping['Augur'] = this.augur!.address;
        if (this.universe) mapping['Universe'] = this.universe.address;
        if (this.contracts.get('Augur').address === undefined) throw new Error(`Augur not uploaded.`);
        mapping['Augur'] = this.contracts.get('Augur').address!;
        mapping['LegacyReputationToken'] = this.contracts.get('LegacyReputationToken').address!;
        mapping['Cash'] = this.contracts.get('Cash').address!;
        for (let contract of this.contracts) {
            if (/^I[A-Z].*/.test(contract.contractName)) continue;
            if (contract.contractName === 'TimeControlled') continue;
            if (contract.contractName === 'Universe') continue;
            if (contract.contractName === 'ReputationToken') continue;
            if (contract.contractName === 'TestNetReputationToken') continue;
            if (contract.contractName === 'TestNetReputationTokenFactory') continue;
            if (contract.contractName === 'Time') contract = this.configuration.useNormalTime ? contract: this.contracts.get('TimeControlled');
            if (contract.contractName === 'ReputationTokenFactory') contract = this.configuration.isProduction ? contract: this.contracts.get('TestNetReputationTokenFactory');
            if (contract.relativeFilePath.startsWith('legacy_reputation/')) continue;
            if (contract.relativeFilePath.startsWith('external/')) continue;
            if (contract.contractName !== 'Map' && contract.relativeFilePath.startsWith('libraries/')) continue;
            if (['Cash', 'TestNetDaiVat', 'TestNetDaiPot', 'TestNetDaiJoin'].includes(contract.contractName)) continue;
            if (['IAugur', 'IDisputeCrowdsourcer', 'IDisputeWindow', 'IUniverse', 'IMarket', 'IReportingParticipant', 'IReputationToken', 'IOrders', 'IShareToken', 'Order', 'IV2ReputationToken', 'IInitialReporter'].includes(contract.contractName)) continue;
            if (contract.address === undefined) throw new Error(`${contract.contractName} not uploaded.`);
            // @ts-ignore
            mapping[contract.contractName] = contract.address;
        }
        return mapping;
    }

    public getContractAddress = (contractName: string): string => {
        if (!this.contracts.has(contractName)) throw new Error(`Contract named ${contractName} does not exist.`);
        const contract = this.contracts.get(contractName);
        if (contract.address === undefined) throw new Error(`Contract name ${contractName} has not yet been uploaded.`);
        return contract.address;
    }

    private async uploadAugur(): Promise<Augur> {
        console.log('Uploading augur...');
        const contract = await this.contracts.get("Augur");
        const address = await this.construct(this.contracts.get('Augur'), []);
        const augur = new Augur(this.dependencies, address);
        const ownerAddress = await augur.uploader_();
        contract.address = address;
        if (ownerAddress.toLowerCase() !== (await this.signer.getAddress()).toLowerCase()) {
            throw new Error("Augur owner does not equal from address");
        }
        console.log(`Augur address: ${augur.address}`);
        return augur;
    }

    private async uploadTestDaiContracts(): Promise<void> {
        const cashContract = await this.contracts.get("Cash");
        cashContract.address = await this.uploadAndAddToAugur(cashContract, "Cash", []);

        const vatContract = await this.contracts.get("TestNetDaiVat");
        vatContract.address = await this.uploadAndAddToAugur(vatContract, "DaiVat", []);

        const potContract = await this.contracts.get("TestNetDaiPot");
        potContract.address = await this.uploadAndAddToAugur(potContract, "DaiPot", [vatContract.address, await this.augur!.lookup_(stringTo32ByteHex("Time"))]);

        const joinContract = await this.contracts.get("TestNetDaiJoin");
        joinContract.address = await this.uploadAndAddToAugur(joinContract, "DaiJoin", [vatContract.address, cashContract.address]);

        const cash = new Cash(this.dependencies, cashContract.address);
        await cash.initialize(this.augur!.address);
    }

    private async uploadGnosisContracts(): Promise<void> {
        const proxyFactoryContract = await this.contracts.get("ProxyFactory");
        proxyFactoryContract.address = await this.construct(proxyFactoryContract, []);

        const gnosisSafeContract = await this.contracts.get("GnosisSafe");
        gnosisSafeContract.address = await this.construct(gnosisSafeContract, []);
    }

    private async upload0xContracts(): Promise<void> {
        const zeroXExchangeContract = await this.contracts.get("ZeroXExchange");
        zeroXExchangeContract.address = await this.construct(zeroXExchangeContract, []);
    }

    public async uploadLegacyRep(): Promise<string> {
        const contract = await this.contracts.get("LegacyReputationToken");
        contract.address = await this.construct(contract, []);
        return contract.address;
    }

    private async uploadAllContracts(): Promise<void> {
        console.log('Uploading contracts...');
        const promises: Array<Promise<void>> = [];
        for (let contract of this.contracts) {
            promises.push(this.upload(contract));
        }
        await resolveAll(promises);
    }

    private async upload(contract: ContractData): Promise<void> {
        const contractName = contract.contractName
        if (contractName === 'Augur') return;
        if (contractName === 'Delegator') return;
        if (contractName === 'TimeControlled') return;
        if (contractName === 'TestNetReputationTokenFactory') return;
        if (contractName === 'Augur') return;
        if (contractName === 'Universe') return;
        if (contractName === 'ReputationToken') return;
        if (contractName === 'TestNetReputationToken') return;
        if (contractName === 'ProxyFactory') return;
        if (contractName === 'GnosisSafe') return;
        if (contractName === 'Time') contract = this.configuration.useNormalTime ? contract : this.contracts.get('TimeControlled');
        if (contractName === 'ReputationTokenFactory') contract = this.configuration.isProduction ? contract : this.contracts.get('TestNetReputationTokenFactory');
        if (contract.relativeFilePath.startsWith('legacy_reputation/')) return;
        if (this.configuration.isProduction && contractName === 'LegacyReputationToken') return;
        if (this.configuration.isProduction && contractName === 'Cash') return;
        if (this.configuration.isProduction && contractName === 'RepPriceOracle') return;
        if (contractName !== 'Map' && contract.relativeFilePath.startsWith('libraries/')) return;
        if (['Cash', 'TestNetDaiVat', 'TestNetDaiPot', 'TestNetDaiJoin'].includes(contract.contractName)) return;
        if (['IAugur', 'IDisputeCrowdsourcer', 'IDisputeWindow', 'IUniverse', 'IMarket', 'IReportingParticipant', 'IReputationToken', 'IOrders', 'IShareToken', 'Order', 'IV2ReputationToken', 'IInitialReporter'].includes(contract.contractName)) return;
        console.log(`Uploading new version of contract for ${contractName}`);
        contract.address = await this.uploadAndAddToAugur(contract, contractName, []);
    }

    private async uploadAndAddToAugur(contract: ContractData, registrationContractName: string = contract.contractName, constructorArgs: Array<any> = []): Promise<string> {
        const address = await this.construct(contract, constructorArgs);
        await this.augur!.registerContract(stringTo32ByteHex(registrationContractName), address);
        return address;
    }

    private async construct(contract: ContractData, constructorArgs: Array<string>): Promise<string> {
        console.log(`Upload contract: ${contract.contractName}`);
        const factory = new ethers.ContractFactory(contract.abi, contract.bytecode, this.signer);
        const contractObj = await factory.deploy(...constructorArgs);
        await contractObj.deployed();
        console.log(`Uploaded contract: ${contract.contractName}: \"${contractObj.address}\"`);
        return contractObj.address;
    }

    private async initializeAllContracts(): Promise<void> {
        console.log('Initializing contracts...');
        const promises: Array<Promise<any>> = [];

        const completeSetsContract = await this.getContractAddress("CompleteSets");
        const completeSets = new CompleteSets(this.dependencies, completeSetsContract);
        promises.push(completeSets.initialize(this.augur!.address));

        const createOrderContract = await this.getContractAddress("CreateOrder");
        const createOrder = new CreateOrder(this.dependencies, createOrderContract);
        promises.push(createOrder.initialize(this.augur!.address));

        const fillOrderContract = await this.getContractAddress("FillOrder");
        const fillOrder = new FillOrder(this.dependencies, fillOrderContract);
        promises.push(fillOrder.initialize(this.augur!.address));

        const cancelOrderContract = await this.getContractAddress("CancelOrder");
        const cancelOrder = new CancelOrder(this.dependencies, cancelOrderContract);
        promises.push(cancelOrder.initialize(this.augur!.address));

        const tradeContract = await this.getContractAddress("Trade");
        const trade = new Trade(this.dependencies, tradeContract);
        promises.push(trade.initialize(this.augur!.address));

        const claimTradingProceedsContract = await this.getContractAddress("ClaimTradingProceeds");
        const claimTradingProceeds = new ClaimTradingProceeds(this.dependencies, claimTradingProceedsContract);
        promises.push(claimTradingProceeds.initialize(this.augur!.address));

        const ordersContract = await this.getContractAddress("Orders");
        const orders = new Orders(this.dependencies, ordersContract);
        promises.push(orders.initialize(this.augur!.address));

        const profitLossContract = await this.getContractAddress("ProfitLoss");
        const profitLoss = new ProfitLoss(this.dependencies, profitLossContract);
        promises.push(profitLoss.initialize(this.augur!.address));

        const simulateTradeContract = await this.getContractAddress("SimulateTrade");
        const simulateTrade = new SimulateTrade(this.dependencies, simulateTradeContract);
        promises.push(simulateTrade.initialize(this.augur!.address));

        const zeroXTradeTokenContract = await this.getContractAddress("ZeroXTradeToken");
        const zeroXTradeToken = new ZeroXTradeToken(this.dependencies, zeroXTradeTokenContract);
        promises.push(zeroXTradeToken.initialize(this.augur!.address));

        if (!this.configuration.useNormalTime) {
            const timeContract = await this.getContractAddress("TimeControlled");
            const time = new TimeControlled(this.dependencies, timeContract);
            promises.push(time.initialize(this.augur!.address));
        }

        await resolveAll(promises);
    }

    public async initializeLegacyRep(): Promise<void> {
        const legacyReputationToken = new LegacyReputationToken(this.dependencies, this.getContractAddress('LegacyReputationToken'));
        await legacyReputationToken.initializeERC1820(this.augur!.address);
        await legacyReputationToken.faucet(new BigNumber(1));
        const defaultAddress = await this.signer.getAddress();
        const legacyBalance = await legacyReputationToken.balanceOf_(defaultAddress);
        if (!legacyBalance || legacyBalance.isEqualTo(0)) {
            throw new Error("Faucet call to Legacy REP failed");
        }
    }

    public async initializeCash(): Promise<void> {
        const cash = new LegacyReputationToken(this.dependencies, this.getContractAddress('Cash'));
        await cash.faucet(new BigNumber(1));
        const defaultAddress = await this.signer.getAddress();
        const legacyBalance = await cash.balanceOf_(defaultAddress);
        if (!legacyBalance || legacyBalance.isEqualTo(0)) {
            throw new Error("Faucet call to Cash failed");
        }
    }

    private async resetTimeControlled(): Promise<void> {
      console.log('Resetting Timestamp for false time...');
      const time = new TimeControlled(this.dependencies, this.getContractAddress("TimeControlled"));
      const currentTimestamp = await time.getTimestamp_();
      await time.setTimestamp(currentTimestamp);
    }

    private async createGenesisUniverse(): Promise<Universe> {
        console.log('Creating genesis universe...');
        const augur = new Augur(this.dependencies, this.getContractAddress("Augur"));
        const universeAddress = await augur.createGenesisUniverse_();
        if (!universeAddress || universeAddress == "0x") {
            throw new Error("Unable to create genesis universe. eth_call failed");
        }
        await augur.createGenesisUniverse();
        const universe = new Universe(this.dependencies, universeAddress);
        console.log(`Genesis universe address: ${universe.address}`);

        return universe;
    }

    private async migrateFromLegacyRep(): Promise<void> {
        const reputationTokenAddress = await this.universe!.getReputationToken_();
        const reputationToken = new ReputationToken(this.dependencies, reputationTokenAddress);
        const legacyReputationToken = new LegacyReputationToken(this.dependencies, this.getContractAddress('LegacyReputationToken'));
        const defaultAddress = await this.signer.getAddress();
        const legacyBalance = await legacyReputationToken.balanceOf_(defaultAddress);
        await legacyReputationToken.approve(reputationTokenAddress, legacyBalance);
        await reputationToken.migrateFromLegacyReputationToken();
        const balance = await reputationToken.balanceOf_(defaultAddress);
        if (!balance || balance == new BigNumber(0)) {
            throw new Error("Migration from Legacy REP failed");
        }
    }

    private async generateAddressMappingFile(): Promise<void> {
        type ContractAddressMapping = { [name: string]: string };

        const mapping: ContractAddressMapping = {};
        mapping['Augur'] = this.augur!.address;
        if (this.universe) mapping['Universe'] = this.universe.address;
        if (this.contracts.get('Augur').address === undefined) throw new Error(`Augur not uploaded.`);
        mapping['Augur'] = this.contracts.get('Augur').address!;
        mapping['LegacyReputationToken'] = this.contracts.get('LegacyReputationToken').address!;
        mapping['Cash'] = this.contracts.get('Cash').address!;
        mapping['ProxyFactory'] = this.contracts.get('ProxyFactory').address!;
        mapping['GnosisSafe'] = this.contracts.get('GnosisSafe').address!;
        if (this.contracts.get('TimeControlled')) mapping['TimeControlled'] = this.contracts.get('TimeControlled').address;
        for (let contract of this.contracts) {
            if (!contract.relativeFilePath.startsWith('trading/')) continue;
            if (/^I[A-Z].*/.test(contract.contractName)) continue;
            if (contract.address === undefined) throw new Error(`${contract.contractName} not uploaded.`);
            mapping[contract.contractName] = contract.address;
        }

        const networkId = (await this.provider.getNetwork()).chainId;

        await setAddresses(String(networkId) as NetworkId, mapping as unknown as ContractAddresses);
    }

    private async generateUploadBlockNumberMapping(blockNumber: number): Promise<string> {
        type UploadBlockNumberMapping = { [networkId: string]: number };

        const networkId = (await this.provider.getNetwork()).chainId;
        let blockNumberMapping: UploadBlockNumberMapping  = {};
        if (await exists(this.configuration.uploadBlockNumbersOutputPath)) {
            let existingBlockNumberData: string = await readFile(this.configuration.uploadBlockNumbersOutputPath, 'utf8');
            blockNumberMapping = JSON.parse(existingBlockNumberData);
        }
        blockNumberMapping[networkId] = blockNumber;
        return JSON.stringify(blockNumberMapping, null, '  ');
    }

    private async generateUploadBlockNumberFile(blockNumber: number): Promise<void> {
        const blockNumberMapping = await this.generateUploadBlockNumberMapping(blockNumber);
        await writeFile(this.configuration.uploadBlockNumbersOutputPath, blockNumberMapping, 'utf8')
    }

}
