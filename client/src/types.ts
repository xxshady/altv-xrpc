import type { RpcEventName, RemotePendingController, IClientOnServerEvent, IServerOnClientEvent, IWebViewOnClientEvent, IClientOnWebViewEvent } from "altv-xrpc-shared"

export type RemotePendingEvents = Map<RpcEventName, RemotePendingController>

export type ToggleServerEventHandler = <K extends keyof IClientOnServerEvent>(event: K, handler: IClientOnServerEvent[K]) => void

export interface IEventApi {
  onServer: ToggleServerEventHandler
  offServer: ToggleServerEventHandler
  emitServer: <K extends keyof IServerOnClientEvent>(
    event: K,
    ...args: Parameters<IServerOnClientEvent[K]>
  ) => void
}

export interface IWebView {
  emit: <K extends keyof IWebViewOnClientEvent>(
    event: K,
    ...args: Parameters<IWebViewOnClientEvent[K]>
  ) => void
  on: <K extends keyof IClientOnWebViewEvent>(
    event: K,
    handler: IClientOnWebViewEvent[K]
  ) => void
}
