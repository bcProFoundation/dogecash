// Copyright (c) 2024 The Bitcoin developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ChildProcess } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { ChronikClientNode, Tx_InNode } from '../../index';
import initializeTestRunner from '../setup/testRunner';

const expect = chai.expect;
chai.use(chaiAsPromised);

describe('Get blocktxs, txs, and history for SLP 2 mint vault token txs', () => {
    let testRunner: ChildProcess;
    let chronik_url: Promise<Array<string>>;
    let get_vault_setup_txid: Promise<string>;
    let get_slp_vault_genesis_txid: Promise<string>;
    let get_slp_vault_mint_txid: Promise<string>;
    const statusEvent = new EventEmitter();

    before(async () => {
        testRunner = initializeTestRunner(
            'chronik-client_token_slp_mint_vault',
        );

        testRunner.on('message', function (message: any) {
            if (message && message.chronik) {
                console.log('Setting chronik url to ', message.chronik);
                chronik_url = new Promise(resolve => {
                    resolve([message.chronik]);
                });
            }
            if (message && message.vault_setup_txid) {
                get_vault_setup_txid = new Promise(resolve => {
                    resolve(message.vault_setup_txid);
                });
            }

            if (message && message.slp_vault_genesis_txid) {
                get_slp_vault_genesis_txid = new Promise(resolve => {
                    resolve(message.slp_vault_genesis_txid);
                });
            }

            if (message && message.slp_vault_mint_txid) {
                get_slp_vault_mint_txid = new Promise(resolve => {
                    resolve(message.slp_vault_mint_txid);
                });
            }

            if (message && message.status) {
                statusEvent.emit(message.status);
            }
        });
    });

    after(() => {
        testRunner.send('stop');
    });

    beforeEach(async () => {
        await once(statusEvent, 'ready');
    });

    afterEach(() => {
        testRunner.send('next');
    });

    const CHAIN_INIT_HEIGHT = 100;
    const MINT_VAULT_SCRIPTHASH = '28e2146de5a061bf57845a04968d89cbdab733e3';
    const BASE_TX_INPUT = {
        prevOut: {
            txid: 'b85c9fecfc2aeb0992fd05c62688c5b631c22e2e874ffeb4c3fbf5ad778848a3',
            outIdx: 1,
        },
        inputScript: '0151',
        outputScript: 'a914da1745e9b549bd0bfa1a569971c77eba30cd5a4b87',
        value: 100000,
        sequenceNo: 0,
    };
    const BASE_TX_OUTPUT = {
        value: 10000,
        outputScript: 'a914da1745e9b549bd0bfa1a569971c77eba30cd5a4b87',
        spentBy: undefined,
    };
    const BASE_TX_TOKEN_INFO_SLP_V2 = {
        tokenType: {
            protocol: 'SLP',
            type: 'SLP_TOKEN_TYPE_MINT_VAULT',
            number: 2,
        },
        entryIdx: 0,
        amount: '1000',
        isMintBaton: false,
    };
    const BASE_TOKEN_ENTRY = {
        // omit tokenId, txType, and tokenType as these should always be tested
        isInvalid: false,
        burnSummary: '',
        failedColorings: [],
        actualBurnAmount: '0',
        intentionalBurn: '0',
        burnsMintBatons: false,
    };

    let vaultSetupTxid = '';
    let slpVaultGenesisTxid = '';
    let slpVaultMintTxid = '';

    let vaultSetup: Tx_InNode;
    let slpVaultGenesis: Tx_InNode;
    let slpVaultMint: Tx_InNode;

    it('Gets an SLP vault setup tx from the mempool', async () => {
        const chronikUrl = await chronik_url;
        const chronik = new ChronikClientNode(chronikUrl);

        vaultSetupTxid = await get_vault_setup_txid;

        vaultSetup = await chronik.tx(vaultSetupTxid);

        // We get expected inputs including expected Token data
        // We get no token info in tx inputs
        expect(vaultSetup.inputs).to.deep.equal([
            {
                ...BASE_TX_INPUT,
            },
        ]);

        // We get expected outputs including expected Token data
        // We get no token info in tx outputs
        expect(vaultSetup.outputs).to.deep.equal([
            {
                ...BASE_TX_OUTPUT,
                outputScript: 'a91428e2146de5a061bf57845a04968d89cbdab733e387',
            },
            {
                ...BASE_TX_OUTPUT,
                outputScript: 'a91428e2146de5a061bf57845a04968d89cbdab733e387',
            },
            {
                ...BASE_TX_OUTPUT,
                value: 79000,
                outputScript: 'a91428e2146de5a061bf57845a04968d89cbdab733e387',
            },
        ]);

        // No token entries before confirmation
        expect(vaultSetup.tokenEntries).to.deep.equal([]);

        // The token did not fail parsings
        expect(vaultSetup.tokenFailedParsings).to.deep.equal([]);

        // Normal status
        expect(vaultSetup.tokenStatus).to.eql('TOKEN_STATUS_NON_TOKEN');
    });
    it('Gets this tx from a block', async () => {
        const chronikUrl = await chronik_url;
        const chronik = new ChronikClientNode(chronikUrl);

        const blockTxs = await chronik.blockTxs(CHAIN_INIT_HEIGHT + 2);
        const confirmedVaultSetup = blockTxs.txs.find(
            tx => tx.txid === vaultSetupTxid,
        );

        // No change in tokenEntries
        expect(confirmedVaultSetup?.tokenEntries).to.deep.equal(
            vaultSetup.tokenEntries,
        );

        // We can also get this tx from script history
        const history = await chronik
            .script('p2sh', MINT_VAULT_SCRIPTHASH)
            .history();

        // It's the same as what we get from blockTxs
        expect(history.txs[0]).to.deep.equal(confirmedVaultSetup);
    });
    it('Gets an SLP vault genesis tx from the mempool', async () => {
        const chronikUrl = await chronik_url;
        const chronik = new ChronikClientNode(chronikUrl);

        slpVaultGenesisTxid = await get_slp_vault_genesis_txid;

        slpVaultGenesis = await chronik.tx(slpVaultGenesisTxid);

        // We get expected inputs
        // No token data is expected or returned
        expect(slpVaultGenesis.inputs).to.deep.equal([
            {
                ...BASE_TX_INPUT,
                prevOut: {
                    txid: 'b85c9fecfc2aeb0992fd05c62688c5b631c22e2e874ffeb4c3fbf5ad778848a3',
                    outIdx: 0,
                },
            },
        ]);

        // We get expected outputs including expected Token data
        expect(slpVaultGenesis.outputs).to.deep.equal([
            {
                ...BASE_TX_OUTPUT,
                value: 0,
                outputScript:
                    '6a04534c500001020747454e4553495308534c505641554c540130013020787878787878787878787878787878787878787878787878787878787878787801001428e2146de5a061bf57845a04968d89cbdab733e30800000000000003e8',
            },
            {
                ...BASE_TX_OUTPUT,
                value: 546,
                token: {
                    ...BASE_TX_TOKEN_INFO_SLP_V2,
                    tokenId: slpVaultGenesisTxid,
                },
            },
            {
                ...BASE_TX_OUTPUT,
                value: 99000,
            },
        ]);

        // We get a Entries of expected shape, with tokenId the txid of the genesis tx
        expect(slpVaultGenesis.tokenEntries).to.deep.equal([
            {
                ...BASE_TOKEN_ENTRY,
                tokenId:
                    '768626ba27515513f148d714453bd2964f0de49c6686fa54da56ae4e19387c70',
                tokenType: {
                    protocol: 'SLP',
                    type: 'SLP_TOKEN_TYPE_MINT_VAULT',
                    number: 2,
                },
                txType: 'GENESIS',
            },
        ]);

        // The token did not fail parsings
        expect(slpVaultGenesis.tokenFailedParsings).to.deep.equal([]);

        // Normal status
        expect(slpVaultGenesis.tokenStatus).to.eql('TOKEN_STATUS_NORMAL');

        // We can get token info of an slp vault token from the mempool
        const slpGenesisMempoolInfo = await chronik.token(slpVaultGenesisTxid);
        expect(slpGenesisMempoolInfo).to.deep.equal({
            tokenId: slpVaultGenesisTxid,
            timeFirstSeen: '1300000000',
            tokenType: {
                protocol: 'SLP',
                type: 'SLP_TOKEN_TYPE_MINT_VAULT',
                number: 2,
            },
            // We get mintVaultScripthash in GenesisInfo for SLP MINT VAULT
            // We get hash in GenesisInfo for SLP
            // We do not get data or authPubkey keys in GenesisInfo for non-ALP
            genesisInfo: {
                tokenTicker: 'SLPVAULT',
                tokenName: '0',
                url: '0',
                hash: '7878787878787878787878787878787878787878787878787878787878787878',
                mintVaultScripthash: '28e2146de5a061bf57845a04968d89cbdab733e3',
                decimals: 0,
            },
        });
    });
    it('Gets a badly constructed SLP v2 Vault Mint tx from the mempool', async () => {
        const chronikUrl = await chronik_url;
        const chronik = new ChronikClientNode(chronikUrl);

        slpVaultMintTxid = await get_slp_vault_mint_txid;

        slpVaultMint = await chronik.tx(slpVaultMintTxid);

        // We get expected inputs. No token data is expected in inputs.
        expect(slpVaultMint.inputs).to.deep.equal([
            {
                ...BASE_TX_INPUT,
                prevOut: {
                    txid: '34d22b0d3dd9b1ac75a01125fa5d778d5ddde2dea098416479c011340684702f',
                    outIdx: 0,
                },
                inputScript: '015c',
                outputScript: 'a91428e2146de5a061bf57845a04968d89cbdab733e387',
                value: 10000,
            },
        ]);

        // We get expected outputs. No token data expected in outputs due to validation error in this tx.
        expect(slpVaultMint.outputs).to.deep.equal([
            {
                ...BASE_TX_OUTPUT,
                value: 0,
                outputScript:
                    '6a04534c50000102044d494e5420768626ba27515513f148d714453bd2964f0de49c6686fa54da56ae4e19387c70080000000000000fa0',
            },
            {
                ...BASE_TX_OUTPUT,
                value: 9000,
            },
        ]);

        // We get a Entries of expected shape, with tokenId the txid of the genesis tx
        expect(slpVaultMint.tokenEntries).to.deep.equal([
            {
                ...BASE_TOKEN_ENTRY,
                tokenId: slpVaultGenesisTxid,
                tokenType: {
                    protocol: 'SLP',
                    type: 'SLP_TOKEN_TYPE_MINT_VAULT',
                    number: 2,
                },
                txType: 'MINT',
                isInvalid: true,
                burnSummary: 'Validation error: Missing MINT vault',
            },
        ]);

        // The token did not fail parsings
        expect(slpVaultMint.tokenFailedParsings).to.deep.equal([]);

        // Not normal status (missing mint vault)
        expect(slpVaultMint.tokenStatus).to.eql('TOKEN_STATUS_NOT_NORMAL');
    });
});