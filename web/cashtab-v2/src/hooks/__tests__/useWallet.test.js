/**
 * @jest-environment ./config/jest/uint8array-environment
 */

import useWallet from '../useWallet';
import { renderHook } from '@testing-library/react-hooks';
import mockLegacyWallets from '../__mocks__/mockLegacyWallets';
import BCHJS from '@psf/bch-js';
import useBCH from '../useBCH';

jest.mock('../useBCH');
test('Migrating legacy wallet on testnet', async () => {
    useBCH.mockReturnValue({ getBCH: () => new BCHJS() });
    const { result } = renderHook(() => useWallet());
    process = {
        env: {
            REACT_APP_NETWORK: `testnet`,
            REACT_APP_BCHA_APIS:
                'https://rest.kingbch.com/v3/,https://wallet-service-prod.bitframe.org/v3/,notevenaurl,https://rest.kingbch.com/v3/',
            REACT_APP_BCHA_APIS_TEST: 'https://free-test.fullstack.cash/v3/',
        },
    };

    const BCH = new BCHJS();
    result.current.getWallet = false;
    let wallet;
    wallet = await result.current.migrateLegacyWallet(
        BCH,
        mockLegacyWallets.legacyAlphaTestnet,
    );

    expect(wallet).toStrictEqual(mockLegacyWallets.migratedLegacyAlphaTestnet);
});

test('Migrating legacy wallet on mainnet', async () => {
    useBCH.mockReturnValue({ getBCH: () => new BCHJS() });
    const { result } = renderHook(() => useWallet());
    process = {
        env: {
            REACT_APP_NETWORK: `mainnet`,
            REACT_APP_BCHA_APIS:
                'https://rest.kingbch.com/v3/,https://wallet-service-prod.bitframe.org/v3/,notevenaurl,https://rest.kingbch.com/v3/',
            REACT_APP_BCHA_APIS_TEST: 'https://free-test.fullstack.cash/v3/',
        },
    };

    const BCH = new BCHJS();
    result.current.getWallet = false;
    let wallet;
    wallet = await result.current.migrateLegacyWallet(
        BCH,
        mockLegacyWallets.legacyAlphaMainnet,
    );
    expect(wallet).toStrictEqual(mockLegacyWallets.migratedLegacyAlphaMainnet);
});
