import * as alt from "alt-client"
import * as shared from "altv-xrpc-shared"
import { logger, logObject } from "./logger"
import type { RemotePendingEvents } from "./types"

export class Rpc extends shared.SharedRpc {
  private readonly serverPendingEvents: RemotePendingEvents = new Map()
  private readonly webViewPendingEvents: RemotePendingEvents = new Map()
  private webView: alt.WebView | null = null

  constructor() {
    super(logObject)

    // TODO: add ts check for events
    alt.onServer(shared.ClientOnServerEvents.CallEvent, this.onServerCallEvent.bind(this))
    alt.onServer(shared.ClientOnServerEvents.EventResponse, this.onServerEventResponse.bind(this))

    alt.onServer(shared.ClientOnServerEvents.CallWebViewEvent, this.onServerCallWebViewEvent.bind(this))
    alt.onServer(shared.ClientOnServerEvents.WebViewEventResponse, this.onServerWebViewEventResponse.bind(this))
  }

  private async onServerCallEvent(rpcName: shared.RpcEventName, args: unknown[]): Promise<void> {
    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ClientOnServer,
      args,
    )
    if (!params) return

    this.emitServerRpcEvent(shared.ServerOnClientEvents.EventResponse, params)
  }

  private onServerCallWebViewEvent(rpcName: shared.RpcEventName, args: unknown[]): void {
    if (!this.webView) {
      logger.info("onServerCallWebViewEvent webview not added")

      this.emitServerRpcEvent(
        shared.ServerOnClientEvents.WebViewEventResponse,
        [rpcName, shared.ErrorCodes.WebViewNotAdded],
      )
    }

    this.emitWebViewRpcEvent(
      shared.WebViewOnClientEvents.CallEventFromServer,
      [rpcName, args],
    )
  }

  private onWebViewServerEventResponse(
    rpcName: shared.RpcEventName,
    error: shared.ErrorCodes | null,
    result: unknown,
  ): void {
    logger.info("onWebViewServerEventResponse", rpcName, error, result)

    this.emitServerRpcEvent(shared.ServerOnClientEvents.WebViewEventResponse, [rpcName, error, result])
  }

  private async onWebViewCallEvent(rpcName: shared.RpcEventName, args: unknown[]): Promise<void> {
    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ClientOnWebView,
      args,
    )
    if (!params) return

    this.emitWebViewRpcEvent(shared.WebViewOnClientEvents.EventResponse, params)
  }

  private onWebViewEventResponse(rpcName: shared.RpcEventName, error: shared.ErrorCodes | null, result: unknown): void {
    const webViewPending = this.webViewPendingEvents.get(rpcName)

    if (!webViewPending) {
      logger.warn(`[onWebViewEventResponse] rpc name: "${rpcName}" received expired response: ${result}`)
      return
    }

    error
      ? webViewPending.reject(`rpc.emitWebView rpc name: "${rpcName}" failed`, error)
      : webViewPending.resolve(result)
  }

  private onWebViewCallServerEvent(rpcName: shared.RpcEventName, args: unknown[]): void {
    this.emitServerRpcEvent(
      shared.ServerOnClientEvents.CallEventFromWebView,
      [rpcName, args],
    )
  }

  private onServerEventResponse(rpcName: shared.RpcEventName, error: shared.ErrorCodes | null, result: unknown): void {
    const serverPending = this.serverPendingEvents.get(rpcName)

    if (!serverPending) {
      logger.warn(`[onServerEventResponse] rpc name: "${rpcName}" received expired response: ${result}`)
      return
    }

    error
      ? serverPending.reject(`rpc.emitServer rpc name: "${rpcName}" failed`, error)
      : serverPending.resolve(result)
  }

  private onServerWebViewEventResponse(rpcName: shared.RpcEventName, error: shared.ErrorCodes | null, result: unknown): void {
    logger.info("onServerWebViewEventResponse", "rpc:", rpcName, "err:", error, "result:", result)

    this.emitWebViewRpcEvent(shared.WebViewOnClientEvents.ServerEventResponse, [rpcName, error, result])
  }

  private emitServerRpcEvent <K extends keyof shared.IServerOnClientEvent>(
    eventName: K,
    args: Parameters<shared.IServerOnClientEvent[K]>,
  ): void {
    alt.emitServer(eventName, ...args)
  }

  private emitWebViewRpcEvent <K extends keyof shared.IWebViewOnClientEvent>(
    eventName: K,
    args: Parameters<shared.IWebViewOnClientEvent[K]>,
  ): void {
    this.webView?.emit(eventName, ...args)
  }

  private checkPendingServerEvent(rpcName: shared.RpcEventName): shared.RemotePendingController | undefined {
    const serverPendingEvent = this.serverPendingEvents.get(rpcName)

    if (serverPendingEvent)
      throw new shared.RpcError(`server rpc name: "${rpcName}"`, shared.ErrorCodes.AlreadyPending)

    return serverPendingEvent
  }

  private checkPendingWebViewEvent(rpcName: shared.RpcEventName): shared.RemotePendingController | undefined {
    const webViewPendingEvent = this.webViewPendingEvents.get(rpcName)

    if (webViewPendingEvent)
      throw new shared.RpcError(`rpc name: "${rpcName}"`, shared.ErrorCodes.AlreadyPending)

    return webViewPendingEvent
  }

  public onServer(rpcName: shared.RpcEventName, handler: shared.UnknownEventHandler): void {
    this.addHandler(rpcName, shared.RpcHandlerType.ClientOnServer, handler)
  }

  public offServer(rpcName: shared.RpcEventName): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.ClientOnServer)
  }

  public emitServer(rpcName: shared.RpcEventName, ...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const serverPending: shared.RemotePendingController =
        this.checkPendingServerEvent(rpcName) ??
        new shared.RemotePendingController({
          rpcName,
          resolve,
          reject,
          finish: (result: unknown): void => {
            this.serverPendingEvents.delete(rpcName)

            logger.info(
              `rpc name: "${rpcName}" finished with result: ~gl~` +
              `${(result as unknown)?.constructor?.name} ${JSON.stringify(result)}`,
            )
          },
          timeout: this.defaultTimeout,
        })

      this.serverPendingEvents.set(rpcName, serverPending)
      this.emitServerRpcEvent(shared.ServerOnClientEvents.CallEvent, [rpcName, args])
    })
  }

  public useWebView(webView: alt.WebView): void {
    if (this.webView) throw new Error("WebView already added")

    this.webView = webView
    webView.on(shared.ClientOnWebViewEvents.ServerEventResponse, this.onWebViewServerEventResponse.bind(this))
    webView.on(shared.ClientOnWebViewEvents.CallEvent, this.onWebViewCallEvent.bind(this))
    webView.on(shared.ClientOnWebViewEvents.EventResponse, this.onWebViewEventResponse.bind(this))
    webView.on(shared.ClientOnWebViewEvents.CallServerEvent, this.onWebViewCallServerEvent.bind(this))
  }

  public onWebView(rpcName: shared.RpcEventName, handler: shared.UnknownEventHandler): void {
    this.addHandler(rpcName, shared.RpcHandlerType.ClientOnWebView, handler)
  }

  public emitWebView(rpcName: shared.RpcEventName, ...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const webViewPending: shared.RemotePendingController =
        this.checkPendingWebViewEvent(rpcName) ??
        new shared.RemotePendingController({
          rpcName,
          resolve,
          reject,
          finish: (result: unknown): void => {
            this.webViewPendingEvents.delete(rpcName)

            logger.info(
              `webview rpc name: "${rpcName}" finished with result: ~gl~` +
              `${(result as unknown)?.constructor?.name} ${JSON.stringify(result)}`,
            )
          },
          timeout: this.defaultTimeout,
        })

      this.webViewPendingEvents.set(rpcName, webViewPending)
      this.emitWebViewRpcEvent(shared.WebViewOnClientEvents.CallEvent, [rpcName, args])
    })
  }
}
