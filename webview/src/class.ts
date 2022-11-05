import * as shared from "altv-xrpc-shared"
import type { IClientWebViewRpc, IServerWebViewRpc, IWebViewClientRpc, IWebViewServerRpc } from "altv-xrpc-shared-types"
import type { PendingEvents } from "./types"

const logger = new shared.Logger(console)

declare const alt: {
  on<K extends keyof shared.IWebViewOnClientEvent>(event: K, handler: shared.IWebViewOnClientEvent[K]): void
  emit<K extends keyof shared.IClientOnWebViewEvent>(event: K, ...args: Parameters<shared.IClientOnWebViewEvent[K]>): void
}

export class Rpc extends shared.SharedRpc {
  private readonly serverPendingEvents: PendingEvents = new Map()
  private readonly clientPendingEvents: PendingEvents = new Map()

  constructor() {
    super()

    alt.on(shared.WebViewOnClientEvents.CallEvent, this.onClientCallEvent.bind(this))
    alt.on(shared.WebViewOnClientEvents.EventResponse, this.onClientEventResponse.bind(this))
    alt.on(shared.WebViewOnClientEvents.CallEventFromServer, this.onCallEventFromServer.bind(this))
    alt.on(shared.WebViewOnClientEvents.ServerEventResponse, this.onServerEventResponse.bind(this))
  }

  private async onCallEventFromServer(rpcName: shared.RpcEventName, args: unknown[]): Promise<void> {
    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.WebViewOnServer,
      args,
    )
    if (!params) return

    alt.emit(shared.ClientOnWebViewEvents.ServerEventResponse, ...params)
  }

  private onServerEventResponse(rpcName: shared.RpcEventName, error: shared.ErrorCodes | null, result?: unknown): void {
    const serverPending = this.serverPendingEvents.get(rpcName)

    if (!serverPending) {
      logger.warn(`[onServerEventResponse] rpc name: "${rpcName}" received expired response: ${result}`)
      return
    }

    error
      ? serverPending.reject(`rpc.emitServer rpc name: "${rpcName}" failed`, error)
      : serverPending.resolve(result)
  }

  private onClientEventResponse(rpcName: shared.RpcEventName, error: shared.ErrorCodes | null, result: unknown): void {
    const clientPending = this.clientPendingEvents.get(rpcName)

    if (!clientPending) {
      logger.warn(`[onClientEventResponse] rpc name: "${rpcName}" received expired response: ${result}`)
      return
    }

    error
      ? clientPending.reject(`rpc.emitClient rpc name: "${rpcName}" failed`, error)
      : clientPending.resolve(result)
  }

  private async onClientCallEvent(rpcName: shared.RpcEventName, args: unknown[]): Promise<void> {
    logger.info("[webview] onClientCallEvent", rpcName, args)

    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.WebViewOnClient,
      args,
    )
    if (!params) return

    alt.emit(shared.ClientOnWebViewEvents.EventResponse, ...params)
  }

  private checkPendingServerEvent(rpcName: shared.RpcEventName): shared.RemotePendingController | undefined {
    const serverPendingEvent = this.serverPendingEvents.get(rpcName)

    if (serverPendingEvent)
      throw new shared.RpcError(`server rpc name: "${rpcName}"`, shared.ErrorCodes.AlreadyPending)

    return serverPendingEvent
  }

  private checkPendingClientEvent(rpcName: shared.RpcEventName): shared.RemotePendingController | undefined {
    const clientPendingEvent = this.clientPendingEvents.get(rpcName)

    if (clientPendingEvent)
      throw new shared.RpcError(`client rpc name: "${rpcName}"`, shared.ErrorCodes.AlreadyPending)

    return clientPendingEvent
  }

  public onServer<K extends keyof IServerWebViewRpc>(
    rpcName: K,
    handler: (...args: Parameters<IServerWebViewRpc[K]>) => ReturnType<IServerWebViewRpc[K]>,
  ): void {
    this.addHandler(rpcName, shared.RpcHandlerType.WebViewOnServer, handler as shared.UnknownEventHandler)
  }

  public offServer<K extends keyof IServerWebViewRpc>(rpcName: K): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.WebViewOnServer)
  }

  public onClient<K extends keyof IClientWebViewRpc>(
    rpcName: K,
    handler: (...args: Parameters<IClientWebViewRpc[K]>) => ReturnType<IClientWebViewRpc[K]>,
  ): void {
    this.addHandler(rpcName, shared.RpcHandlerType.WebViewOnClient, handler as shared.UnknownEventHandler)
  }

  public offClient<K extends keyof IClientWebViewRpc>(rpcName: K): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.WebViewOnClient)
  }

  public emitClient<K extends keyof IWebViewClientRpc>(
    rpcName: K,
    ...args: Parameters<IWebViewClientRpc[K]>[]
  ): Promise<ReturnType<IWebViewClientRpc[K]>> {
    return new Promise((resolve, reject) => {
      const clientPending: shared.RemotePendingController =
        this.checkPendingClientEvent(rpcName) ??
        new shared.RemotePendingController({
          rpcName,
          resolve,
          reject,
          finish: (result: unknown): void => {
            this.clientPendingEvents.delete(rpcName)

            logger.info(`client rpc name: "${rpcName}" finished with result:`, result)
          },
          timeout: this.defaultTimeout,
        })

      this.clientPendingEvents.set(rpcName, clientPending)
      alt.emit(shared.ClientOnWebViewEvents.CallEvent, rpcName, args)
    })
  }

  public emitServer<K extends keyof IWebViewServerRpc>(
    rpcName: K,
    ...args: Parameters<IWebViewServerRpc[K]>[]
  ): Promise<ReturnType<IWebViewServerRpc[K]>> {
    return new Promise((resolve, reject) => {
      const clientPending: shared.RemotePendingController =
        this.checkPendingServerEvent(rpcName) ??
        new shared.RemotePendingController({
          rpcName,
          resolve,
          reject,
          finish: (result: unknown): void => {
            this.serverPendingEvents.delete(rpcName)

            logger.info(`[webview] server rpc name: "${rpcName}" finished with result:`, result)
          },
          timeout: this.defaultTimeout,
        })

      this.serverPendingEvents.set(rpcName, clientPending)
      alt.emit(shared.ClientOnWebViewEvents.CallServerEvent, rpcName, args)
    })
  }
}
