import * as shared from "altv-xrpc-shared"
import type {
  IClientServerRpc,
  IClientWebViewRpc,
  IServerClientRpc,
  IWebViewClientRpc,
} from "altv-xrpc-shared-types"
import { logger, logObject } from "./logger"
import type { IEventApi, IWebView, RemotePendingEvents, ToggleServerEventHandler } from "./types"

export class Rpc extends shared.SharedRpc {
  private static instance: Rpc | null = null

  private readonly serverPendingEvents: RemotePendingEvents = new Map()
  private readonly webViewPendingEvents: RemotePendingEvents = new Map()
  private webView: IWebView | null = null

  private readonly eventApi: IEventApi
  private serverEventHandlers: Partial<shared.IClientOnServerEvent> = {}

  constructor({ eventApi, webView }: { eventApi: IEventApi; webView?: IWebView }) {
    super(logObject)

    // TODO: maybe add removing of event handlers from previous webview
    if (Rpc.instance?.webView)
      throw new Error("[altv-xrpc] Cannot create a new rpc instance if the previous one uses webview")

    this.eventApi = eventApi

    if (Rpc.instance) Rpc.instance.toggleServerEventHandlers(false)
    this.toggleServerEventHandlers(true)
    Rpc.instance = this

    if (webView)
      this.useWebView(webView)
  }

  private async onServerCallEvent(
    rpcName: shared.RpcEventName,
    args: unknown[],
    timeoutMs: number | null,
  ): Promise<void> {
    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ClientOnServer,
      args,
      timeoutMs ?? this.defaultTimeout,
    )
    if (!params) return

    this.emitServerRpcEvent(shared.ServerOnClientEvents.EventResponse, params)
  }

  private onServerCallWebViewEvent(
    rpcName: shared.RpcEventName,
    args: unknown[],
    timeoutMs: number | null,
  ): void {
    if (!this.webView) {
      logger.info("onServerCallWebViewEvent webview not added")

      this.emitServerRpcEvent(
        shared.ServerOnClientEvents.WebViewEventResponse,
        [rpcName, shared.ErrorCodes.WebViewNotAdded],
      )
    }

    this.emitWebViewRpcEvent(
      shared.WebViewOnClientEvents.CallEventFromServer,
      [rpcName, args, timeoutMs],
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

  private async onWebViewCallEvent(
    rpcName: shared.RpcEventName,
    args: unknown[],
    timeoutMs: number | null,
  ): Promise<void> {
    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ClientOnWebView,
      args,
      timeoutMs ?? this.defaultTimeout,
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

  private onWebViewCallServerEvent(rpcName: shared.RpcEventName, args: unknown[], timeoutMs: number | null): void {
    this.emitServerRpcEvent(
      shared.ServerOnClientEvents.CallEventFromWebView,
      [rpcName, args, timeoutMs],
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
    this.eventApi.emitServer(eventName, ...args)
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

  private emitWebViewFull<K extends keyof IClientWebViewRpc>(
    rpcName: K,
    timeoutMs: number | null,
    args: Parameters<IClientWebViewRpc[K]>,
  ): Promise<ReturnType<IClientWebViewRpc[K]>> {
    return new Promise((resolve, reject) => {
      if (!this.webView)
        return reject(new Error("WebView is not added"))

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
          timeout: timeoutMs ?? this.defaultTimeout,
        })

      this.webViewPendingEvents.set(rpcName, webViewPending)
      this.emitWebViewRpcEvent(shared.WebViewOnClientEvents.CallEvent, [rpcName, args, timeoutMs])
    })
  }

  private emitServerFull<K extends keyof IClientServerRpc>(
    rpcName: K,
    timeoutMs: number | null,
    args: Parameters<IClientServerRpc[K]>,
  ): Promise<ReturnType<IClientServerRpc[K]>> {
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
          timeout: timeoutMs ?? this.defaultTimeout,
        })

      this.serverPendingEvents.set(rpcName, serverPending)
      this.emitServerRpcEvent(shared.ServerOnClientEvents.CallEvent, [rpcName, args, timeoutMs])
    })
  }

  public onServer<K extends keyof IServerClientRpc>(
    rpcName: K,
    handler: (...args: Parameters<IServerClientRpc[K]>) => shared.ReturnMaybePromise<IServerClientRpc[K]>,
  ): void {
    this.addHandler(rpcName, shared.RpcHandlerType.ClientOnServer, handler as shared.UnknownEventHandler)
  }

  public offServer<K extends keyof IServerClientRpc>(rpcName: K): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.ClientOnServer)
  }

  public emitServer<K extends keyof IClientServerRpc>(
    rpcName: K,
    ...args: Parameters<IClientServerRpc[K]>
  ): Promise<ReturnType<IClientServerRpc[K]>> {
    return this.emitServerFull(rpcName, null, args)
  }

  public emitServerWithTimeout<K extends keyof IClientServerRpc>(
    rpcName: K,
    timeoutMs: number,
    ...args: Parameters<IClientServerRpc[K]>
  ): Promise<ReturnType<IClientServerRpc[K]>> {
    return this.emitServerFull(rpcName, timeoutMs, args)
  }

  public useWebView(webView: IWebView): void {
    if (this.webView) throw new Error("WebView already added")
    this.webView = webView

    webView.on(shared.ClientOnWebViewEvents.ServerEventResponse, this.onWebViewServerEventResponse.bind(this))
    webView.on(shared.ClientOnWebViewEvents.CallEvent, this.onWebViewCallEvent.bind(this))
    webView.on(shared.ClientOnWebViewEvents.EventResponse, this.onWebViewEventResponse.bind(this))
    webView.on(shared.ClientOnWebViewEvents.CallServerEvent, this.onWebViewCallServerEvent.bind(this))
  }

  public onWebView<K extends keyof IWebViewClientRpc>(
    rpcName: K,
    handler: (...args: Parameters<IWebViewClientRpc[K]>) => shared.ReturnMaybePromise<IWebViewClientRpc[K]>,
  ): void {
    if (!this.webView)
      throw new Error("WebView is not added")

    this.addHandler(rpcName, shared.RpcHandlerType.ClientOnWebView, handler as shared.UnknownEventHandler)
  }

  public offWebView<K extends keyof IWebViewClientRpc>(rpcName: K): void {
    if (!this.webView)
      throw new Error("WebView is not added")

    this.removeHandler(rpcName, shared.RpcHandlerType.ClientOnWebView)
  }

  public emitWebView<K extends keyof IClientWebViewRpc>(
    rpcName: K,
    ...args: Parameters<IClientWebViewRpc[K]>
  ): Promise<ReturnType<IClientWebViewRpc[K]>> {
    return this.emitWebViewFull(rpcName, null, args)
  }

  public emitWebViewWithTimeout<K extends keyof IClientWebViewRpc>(
    rpcName: K,
    timeoutMs: number,
    ...args: Parameters<IClientWebViewRpc[K]>
  ): Promise<ReturnType<IClientWebViewRpc[K]>> {
    return this.emitWebViewFull(rpcName, timeoutMs, args)
  }

  private toggleServerEventHandlers(enable: boolean): void {
    if (!enable) {
      for (const name in this.serverEventHandlers) {
        this.eventApi.offServer(
          name as keyof shared.IClientOnServerEvent,

          // fuck off
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.serverEventHandlers[name as keyof shared.IClientOnServerEvent]!,
        )
      }

      this.serverEventHandlers = {}
    }
    else {
      const registerEvent: ToggleServerEventHandler = (event, handler) => {
        this.eventApi.onServer(event, handler)
        this.serverEventHandlers[event] = handler
      }

      registerEvent(shared.ClientOnServerEvents.CallEvent, this.onServerCallEvent.bind(this))
      registerEvent(shared.ClientOnServerEvents.EventResponse, this.onServerEventResponse.bind(this))
      registerEvent(shared.ClientOnServerEvents.CallWebViewEvent, this.onServerCallWebViewEvent.bind(this))
      registerEvent(shared.ClientOnServerEvents.WebViewEventResponse, this.onServerWebViewEventResponse.bind(this))
    }
  }
}
