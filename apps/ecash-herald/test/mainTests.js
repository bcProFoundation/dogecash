// Copyright (c) 2023 The Bitcoin developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

'use strict';
const assert = require('assert');
const cashaddr = require('ecashaddrjs');
const config = require('../config');
const { main } = require('../src/main');
const { MockChronikClient } = require('./mocks/chronikMock');
const { MockTelegramBot, mockChannelId } = require('./mocks/telegramBotMock');

describe('ecash-herald main.js', async function () {
    it('main() starts the app on successful websocket connection', async function () {
        // Currently, chronik needs to subscribe to at least one address
        // even to receive BlockConnected msgs
        const wsTestAddress = config.ifpAddress;
        const { type, hash } = cashaddr.decode(wsTestAddress, true);
        // Initialize chronik mock
        const mockedChronik = new MockChronikClient(wsTestAddress, []);
        const telegramBot = MockTelegramBot;
        const channelId = mockChannelId;

        await main(mockedChronik, wsTestAddress, telegramBot, channelId);

        // Confirm websocket opened
        assert.strictEqual(mockedChronik.wsWaitForOpenCalled, true);
        // Confirm subscribe was called on expected type and hash
        assert.deepEqual(mockedChronik.wsSubscribeCalled, { type, hash });
    });
    it('main() shuts down gracefully if there is an error initializing the websocket connection', async function () {
        // Invalid subscription address
        const wsTestAddress = config.ifpAddress.slice(5);
        // Initialize chronik mock
        const mockedChronik = new MockChronikClient(wsTestAddress, []);
        const telegramBot = MockTelegramBot;
        const channelId = mockChannelId;

        const result = await main(
            mockedChronik,
            wsTestAddress,
            telegramBot,
            channelId,
        );
        assert.deepEqual(result.name, 'ValidationError');
    });
});
