import * as alt from "alt-server"
import * as shared from "altv-xrpc-shared"
import type {
  IEventApi,
  IHooks,
  PlayerPendingEvents,
  ServerOnClientEvent,
  ToggleEventHandler,
} from "./types"
import { nextTickAsync } from "./helpers"
import { logger, logObject } from "./logger"
import type {
  IServerWebViewRpc,
  IClientServerRpc,
  IServerClientRpc,
  IWebViewServerRpc,
} from "altv-xrpc-shared-types"

export class Rpc extends shared.SharedRpc {
  private static instance: Rpc | null = null

  private readonly clientPendingEvents: Map<alt.Player, PlayerPendingEvents> = new Map()
  private readonly webViewPendingEvents: Map<alt.Player, PlayerPendingEvents> = new Map()

  private readonly eventApi: IEventApi
  private readonly hooks: IHooks
  private clientEventHandlers: Partial<ServerOnClientEvent> = {}

  constructor({
    eventApi = {
      emitClient: alt.emitClient,
      offClient: alt.offClient,
      onClient: alt.onClient,
    },
    hooks = {},
  }: {
    eventApi?: IEventApi
    hooks?: IHooks
  }) {
    super(logObject)

    this.eventApi = eventApi
    this.hooks = hooks
    if (Rpc.instance) Rpc.instance.toggleClientEventHandlers(false)
    this.toggleClientEventHandlers(true)
    Rpc.instance = this

    alt.on("playerDisconnect", this.onPlayerDisconnect.bind(this))
  }

  private async onPlayerDisconnect(player: alt.Player): Promise<void> {
    const clientEvents = this.clientPendingEvents.get(player)
    const webViewEvents = this.webViewPendingEvents.get(player)

    logger.info("player disconnect:", player.name, "webview events:", webViewEvents)

    if (!(clientEvents || webViewEvents)) return
    await nextTickAsync()

    if (clientEvents) {
      this.clientPendingEvents.delete(player)

      clientEvents.forEach(
        clientPending => {
          clientPending.reject(
            `rpc name: "${clientPending.rpcName}"`,
            shared.ErrorCodes.PlayerDisconnected,
            false,
          )
        })
    }

    if (webViewEvents) {
      this.webViewPendingEvents.delete(player)

      webViewEvents.forEach(
        clientPending => {
          clientPending.reject(
            `webview rpc name: "${clientPending.rpcName}"`,
            shared.ErrorCodes.PlayerDisconnected,
            false,
          )
        })
    }
  }

  private async onClientCallEvent(
    player: alt.Player,
    rpcName: shared.RpcEventName,
    rawArgs: unknown[],
    timeoutMs: number | null,
  ): Promise<void> {
    logger.info("onClientCallEvent", "player:", player.toString(), rpcName)

    let callingArgs: unknown[]
    const { clientServerCall } = this.hooks
    if (clientServerCall) {
      // TODO: wrap user callback in try catch
      const hookedCall = clientServerCall(player, rpcName, rawArgs)
      if (!hookedCall) {
        logger.error(`client->server rpc name: "${rpcName}" call failed, "clientServerCall" hook returned null (InvalidClientServerArgsOrPlayer)`)
        this.emitClientRpcEvent(
          player,
          shared.ClientOnServerEvents.EventResponse,
          [rpcName, shared.ErrorCodes.InvalidClientServerArgsOrPlayer, null],
        )
        return
      }

      callingArgs = [hookedCall.player, ...hookedCall.args]
    }
    else callingArgs = [player, ...rawArgs]

    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ServerOnClient,
      callingArgs,
      timeoutMs ?? this.defaultTimeout,
    )

    logger.info("callHandlerFromRemoteSide params return:", params)

    if (!params) return
    if (!player.valid) return

    this.emitClientRpcEvent(player, shared.ClientOnServerEvents.EventResponse, params)
  }

  private onClientEventResponse(
    player: alt.Player,
    rpcName: shared.RpcEventName,
    error: shared.ErrorCodes | null,
    rawResponse: unknown,
  ): void {
    const clientPending = this.clientPendingEvents.get(player)?.get(rpcName)

    if (!clientPending) {
      logger.warn(`[onClientEventResponse] rpc name: "${rpcName}" received expired response: ${rawResponse}`)
      return
    }

    let response: unknown
    const { serverClientResponse } = this.hooks
    if (!error && serverClientResponse) {
      // TODO: wrap user callback in try catch
      const hookedResponse = serverClientResponse(player, rpcName, rawResponse)
      if (hookedResponse == null) {
        clientPending.reject(
          `rpc.emitClient rpc name: "${rpcName}" failed, player id: ${player.id}`,
          this.ErrorCodes.InvalidServerClientResponse,
        )
        return
      }
      response = hookedResponse.response
    }
    else response = rawResponse

    error
      ? clientPending.reject(`rpc.emitClient rpc name: "${rpcName}" failed, player id: ${player.id}`, error)
      : clientPending.resolve(response)
  }

  private onWebViewEventResponse(
    player: alt.Player,
    rpcName: shared.RpcEventName,
    error: shared.ErrorCodes | null,
    rawResponse: unknown,
  ): void {
    const webViewPending = this.webViewPendingEvents.get(player)?.get(rpcName)

    if (!webViewPending) {
      logger.warn(`[onWebViewEventResponse] rpc name: "${rpcName}" received expired response: ${rawResponse}`)
      return
    }

    let response: unknown
    const { serverWebViewResponse } = this.hooks
    if (!error && serverWebViewResponse) {
      // TODO: wrap user callback in try catch
      const hookedResponse = serverWebViewResponse(player, rpcName, rawResponse)
      if (hookedResponse == null) {
        webViewPending.reject(
          `rpc.emitWebView rpc name: "${rpcName}" failed, player id: ${player.id}`,
          this.ErrorCodes.InvalidServerWebViewResponse,
        )
        return
      }
      response = hookedResponse.response
    }
    else response = rawResponse

    error
      ? webViewPending.reject(`rpc.emitWebView rpc name: "${rpcName}" failed, player id: ${player.id}`, error)
      : webViewPending.resolve(response)
  }

  private async onWebViewCallEvent(
    player: alt.Player,
    rpcName: shared.RpcEventName,
    rawArgs: unknown[],
    timeoutMs: number | null,
  ): Promise<void> {
    logger.info("onWebViewCallEvent", "player:", player.toString(), "rpc:", rpcName)

    let callingArgs: unknown[]
    const { webViewServerCall } = this.hooks
    if (webViewServerCall) {
      // TODO: wrap user callback in try catch
      const hookedCall = webViewServerCall(player, rpcName, rawArgs)
      if (!hookedCall) {
        logger.error(`webview->server rpc name: "${rpcName}" call failed, "webViewServerCall" hook returned null (InvalidWebViewServerArgsOrPlayer)`)
        this.emitClientRpcEvent(
          player,
          shared.ClientOnServerEvents.WebViewEventResponse,
          [rpcName, shared.ErrorCodes.InvalidWebViewServerArgsOrPlayer, null],
        )
        return
      }

      callingArgs = [hookedCall.player, ...hookedCall.args]
    }
    else callingArgs = [player, ...rawArgs]

    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ServerOnWebView,
      callingArgs,
      timeoutMs ?? this.defaultTimeout,
    )

    logger.info("callHandlerFromRemoteSide params return:", params)

    if (!params) return
    if (!player.valid) return

    this.emitClientRpcEvent(player, shared.ClientOnServerEvents.WebViewEventResponse, params)
  }

  private emitClientRpcEvent <K extends keyof shared.IClientOnServerEvent>(
    player: alt.Player,
    eventName: K,
    args: Parameters<shared.IClientOnServerEvent[K]>,
  ): void {
    logger.info("emitClientRpcEvent", player.toString(), eventName, args)
    this.eventApi.emitClient(player, eventName, ...args)
  }

  private checkPendingClientEvent(player: alt.Player, rpcName: shared.RpcEventName): PlayerPendingEvents | undefined {
    const playerPendingEvents = this.clientPendingEvents.get(player)

    if (playerPendingEvents?.has(rpcName))
      throw new shared.RpcError(`rpc name: "${rpcName}"`, shared.ErrorCodes.AlreadyPending)

    return playerPendingEvents
  }

  private checkPendingWebViewEvent(player: alt.Player, rpcName: shared.RpcEventName): PlayerPendingEvents | undefined {
    const playerPendingEvents = this.webViewPendingEvents.get(player)

    if (playerPendingEvents?.has(rpcName))
      throw new shared.RpcError(`webview rpc name: "${rpcName}"`, shared.ErrorCodes.AlreadyPending)

    return playerPendingEvents
  }

  private emitClientFull<K extends keyof IServerWebViewRpc>(
    player: alt.Player,
    rpcName: K,
    timeoutMs: number | null,
    args: Parameters<IServerWebViewRpc[K]>,
  ): Promise<ReturnType<IServerWebViewRpc[K]>> {
    return new Promise((resolve, reject) => {
      if (!player.valid) {
        reject(new shared.RpcError(`rpc name: "${rpcName}"`, this.ErrorCodes.PlayerDisconnected))
        return
      }

      const playerPendingEvents: PlayerPendingEvents = this.checkPendingClientEvent(
        player,
        rpcName,
      ) ?? new Map()

      playerPendingEvents.set(
        rpcName,
        new shared.RemotePendingController({
          rpcName,
          resolve,
          reject,
          finish: (): void => {
            if (!player.valid) return
            playerPendingEvents.delete(rpcName)
          },
          timeout: timeoutMs ?? this.defaultTimeout,
        }),
      )

      this.clientPendingEvents.set(player, playerPendingEvents)

      this.emitClientRpcEvent(
        player,
        shared.ClientOnServerEvents.CallEvent,
        [rpcName, args, timeoutMs],
      )
    })
  }

  private emitWebViewFull<K extends keyof IServerWebViewRpc>(
    player: alt.Player,
    rpcName: K,
    timeoutMs: number | null,
    args: Parameters<IServerWebViewRpc[K]>,
  ): Promise<ReturnType<IServerWebViewRpc[K]>> {
    return new Promise((resolve, reject) => {
      if (!player.valid) {
        reject(new shared.RpcError(`webview rpc name: "${rpcName}"`, this.ErrorCodes.PlayerDisconnected))
        return
      }

      const webViewPendingEvents: PlayerPendingEvents = this.checkPendingWebViewEvent(
        player,
        rpcName,
      ) ?? new Map()

      webViewPendingEvents.set(
        rpcName,
        new shared.RemotePendingController({
          rpcName,
          resolve,
          reject,
          finish: (): void => {
            if (!player.valid) return
            webViewPendingEvents.delete(rpcName)
          },
          timeout: timeoutMs ?? this.defaultTimeout,
        }),
      )

      this.webViewPendingEvents.set(player, webViewPendingEvents)

      this.emitClientRpcEvent(
        player,
        shared.ClientOnServerEvents.CallWebViewEvent,
        [rpcName, args, timeoutMs],
      )
    })
  }

  public onClient<K extends keyof IClientServerRpc>(
    rpcName: K,
    handler: (player: alt.Player, ...args: Parameters<IClientServerRpc[K]>) => shared.ReturnMaybePromise<IClientServerRpc[K]>,
  ): void {
    this.addHandler(rpcName, shared.RpcHandlerType.ServerOnClient, handler as shared.UnknownEventHandler)
  }

  public offClient<K extends keyof IClientServerRpc>(rpcName: K): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.ServerOnClient)
  }

  public onWebView<K extends keyof IWebViewServerRpc>(
    rpcName: K,
    handler: (player: alt.Player, ...args: Parameters<IWebViewServerRpc[K]>) => shared.ReturnMaybePromise<IWebViewServerRpc[K]>,
  ): void {
    this.addHandler(rpcName, shared.RpcHandlerType.ServerOnWebView, handler as shared.UnknownEventHandler)
  }

  public offWebView<K extends keyof IWebViewServerRpc>(rpcName: K): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.ServerOnWebView)
  }

  public emitClient<K extends keyof IServerClientRpc>(
    player: alt.Player,
    rpcName: K,
    ...args: Parameters<IServerClientRpc[K]>
  ): Promise<ReturnType<IServerClientRpc[K]>> {
    return this.emitClientFull(player, rpcName, null, args)
  }

  public emitClientWithTimeout<K extends keyof IServerClientRpc>(
    player: alt.Player,
    rpcName: K,
    timeoutMs: number,
    ...args: Parameters<IServerClientRpc[K]>
  ): Promise<ReturnType<IServerClientRpc[K]>> {
    return this.emitClientFull(player, rpcName, timeoutMs, args)
  }

  public emitWebView<K extends keyof IServerWebViewRpc>(
    player: alt.Player,
    rpcName: K,
    ...args: Parameters<IServerWebViewRpc[K]>
  ): Promise<ReturnType<IServerWebViewRpc[K]>> {
    return this.emitWebViewFull(player, rpcName, null, args)
  }

  public emitWebViewWithTimeout<K extends keyof IServerWebViewRpc>(
    player: alt.Player,
    rpcName: K,
    timeoutMs: number,
    ...args: Parameters<IServerWebViewRpc[K]>
  ): Promise<ReturnType<IServerWebViewRpc[K]>> {
    return this.emitWebViewFull(player, rpcName, timeoutMs, args)
  }

  private toggleClientEventHandlers(enable: boolean): void {
    if (!enable) {
      for (const name in this.clientEventHandlers) {
        this.eventApi.offClient(
          name as keyof ServerOnClientEvent,

          // fuck off
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.clientEventHandlers[name as keyof ServerOnClientEvent]!,
        )
      }
      this.clientEventHandlers = {}
    }
    else {
      const registerEvent: ToggleEventHandler = (event, handler) => {
        this.eventApi.onClient(event, handler)
        this.clientEventHandlers[event] = handler
      }

      registerEvent(shared.ServerOnClientEvents.CallEvent, this.onClientCallEvent.bind(this))
      registerEvent(shared.ServerOnClientEvents.EventResponse, this.onClientEventResponse.bind(this))
      registerEvent(shared.ServerOnClientEvents.WebViewEventResponse, this.onWebViewEventResponse.bind(this))
      registerEvent(shared.ServerOnClientEvents.CallEventFromWebView, this.onWebViewCallEvent.bind(this))
    }
  }
}
