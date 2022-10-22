import type { ErrorCodes } from "./errors"
import type { RpcEventName } from "./types"

export enum ServerOnClientEvents {
  CallEvent = "rpc:callEvent",
  EventResponse = "rpc:eventResponse",
  CallEventFromWebView = "rpc:callEventFromWebView",
  WebViewEventResponse = "rpc:webViewEventResponse",
}

export enum ClientOnServerEvents {
  CallEvent = "rpc:callEvent",
  EventResponse = "rpc:eventResponse",
  CallWebViewEvent = "rpc:callWebViewEvent",
  WebViewEventResponse = "rpc:webViewEventResponse",
}

export enum WebViewOnClientEvents {
  CallEvent = "rpc:callEvent",
  EventResponse = "rpc:eventResponse",
  CallEventFromServer = "rpc:callEventFromServer",
  ServerEventResponse = "rpc:serverEventResponse",
}

export enum ClientOnWebViewEvents {
  CallEvent = "rpc:callEvent",
  EventResponse = "rpc:eventResponse",
  CallServerEvent = "rpc:callServerEvent",
  ServerEventResponse = "rpc:serverEventResponse",
}

// between two direct-connected sides (e.g. client-server, client-webview, but not server-webview!!)
export interface ISharedOnRemoteEvent {
  "rpc:callEvent"(rpcName: RpcEventName, args: unknown[]): Promise<void>
  "rpc:eventResponse"(rpcName: RpcEventName, error: ErrorCodes | null, result: unknown): void
}

export interface IServerOnClientEvent extends ISharedOnRemoteEvent {
  [ServerOnClientEvents.WebViewEventResponse](rpcName: RpcEventName, error: ErrorCodes | null, result?: unknown): void
  [ServerOnClientEvents.CallEventFromWebView](rpcName: RpcEventName, args: unknown[]): Promise<void>
}

export interface IClientOnServerEvent extends ISharedOnRemoteEvent {
  [ClientOnServerEvents.CallWebViewEvent](rpcName: RpcEventName, args: unknown[]): void
  [ClientOnServerEvents.WebViewEventResponse](rpcName: RpcEventName, error: ErrorCodes | null, result?: unknown): void
}

export interface IWebViewOnClientEvent extends ISharedOnRemoteEvent {
  [WebViewOnClientEvents.CallEventFromServer](rpcName: RpcEventName, args: unknown[]): void
  [WebViewOnClientEvents.ServerEventResponse](rpcName: RpcEventName, error: ErrorCodes | null, result?: unknown): void
}

export interface IClientOnWebViewEvent extends ISharedOnRemoteEvent {
  [ClientOnWebViewEvents.CallServerEvent](rpcName: RpcEventName, args: unknown[]): void
  [ClientOnWebViewEvents.ServerEventResponse](rpcName: RpcEventName, error: ErrorCodes | null, result?: unknown): void
}
