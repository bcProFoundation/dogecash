#!/usr/bin/env python3
# Copyright (c) 2023 The Bitcoin developers
# Distributed under the MIT software license, see the accompanying
# file COPYING or http://www.opensource.org/licenses/mit-license.php.

import http.client
from typing import Union

import chronik_pb2 as pb
import websocket

# Timespan when HTTP requests to Chronik time out
DEFAULT_TIMEOUT = 30


class UnexpectedContentType(Exception):
    pass


class ChronikResponse:
    def __init__(self, status: int, *, ok_proto=None, error_proto=None) -> None:
        self.status = status
        self.ok_proto = ok_proto
        self.error_proto = error_proto

    def ok(self):
        if self.status != 200:
            raise AssertionError(
                f'Expected OK response, but got status {self.status}, error: '
                f'{self.error_proto}')
        return self.ok_proto

    def err(self, status: int):
        if self.status == 200:
            raise AssertionError(
                f'Expected error response status {status}, but got OK: {self.ok_proto}')
        if self.status != status:
            raise AssertionError(
                f'Expected error response status {status}, but got different error '
                f'status {self.status}, error: {self.error_proto}')
        return self.error_proto


class ChronikScriptClient:
    def __init__(self, client: 'ChronikClient', script_type: str,
                 script_payload: str) -> None:
        self.client = client
        self.script_type = script_type
        self.script_payload = script_payload

    def _query_params(self, page=None, page_size=None) -> str:
        if page is not None and page_size is not None:
            return f'?page={page}&page_size={page_size}'
        elif page is not None:
            return f'?page={page}'
        elif page_size is not None:
            return f'?page_size={page_size}'
        else:
            return ''

    def confirmed_txs(self, page=None, page_size=None):
        query = self._query_params(page, page_size)
        return self.client._request_get(
            f'/script/{self.script_type}/{self.script_payload}/confirmed-txs{query}',
            pb.TxHistoryPage)

    def history(self, page=None, page_size=None):
        query = self._query_params(page, page_size)
        return self.client._request_get(
            f'/script/{self.script_type}/{self.script_payload}/history{query}',
            pb.TxHistoryPage)

    def unconfirmed_txs(self):
        return self.client._request_get(
            f'/script/{self.script_type}/{self.script_payload}/unconfirmed-txs',
            pb.TxHistoryPage)

    def utxos(self):
        return self.client._request_get(
            f'/script/{self.script_type}/{self.script_payload}/utxos',
            pb.ScriptUtxos)


class ChronikWs:
    def __init__(self, ws) -> None:
        self.ws = ws

    def recv(self):
        data = self.ws.recv()
        ws_msg = pb.WsMsg()
        ws_msg.ParseFromString(data)
        return ws_msg


class ChronikClient:
    CONTENT_TYPE = 'application/x-protobuf'

    def __init__(self, host: str, port: int, timeout=DEFAULT_TIMEOUT) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout

    def _request_get(self, path: str, pb_type):
        kwargs = {}
        if self.timeout is not None:
            kwargs['timeout'] = self.timeout
        client = http.client.HTTPConnection(self.host, self.port, **kwargs)
        client.request('GET', path)
        response = client.getresponse()
        content_type = response.getheader('Content-Type')
        body = response.read()

        if content_type != self.CONTENT_TYPE:
            raise UnexpectedContentType(
                f'Unexpected Content-Type "{content_type}" (expected '
                f'"{self.CONTENT_TYPE}"), body: {repr(body)}'
            )

        if response.status != 200:
            proto_error = pb.Error()
            proto_error.ParseFromString(body)
            return ChronikResponse(response.status, error_proto=proto_error)

        ok_proto = pb_type()
        ok_proto.ParseFromString(body)
        return ChronikResponse(response.status, ok_proto=ok_proto)

    def block(self, hash_or_height: Union[str, int]) -> ChronikResponse:
        return self._request_get(f'/block/{hash_or_height}', pb.Block)

    def tx(self, txid: str) -> ChronikResponse:
        return self._request_get(f'/tx/{txid}', pb.Tx)

    def script(self, script_type: str, script_payload: str) -> ChronikScriptClient:
        return ChronikScriptClient(self, script_type, script_payload)

    def ws(self, *, timeout=None) -> ChronikWs:
        ws = websocket.WebSocket()
        ws.connect(f'ws://{self.host}:{self.port}/ws', timeout=timeout)
        return ChronikWs(ws)
