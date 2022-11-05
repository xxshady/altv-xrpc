import * as alt from "alt-server"
import * as shared from "altv-xrpc-shared"
import type { PlayerPendingEvents } from "./types"
import { nextTickAsync } from "./helpers"
import { logger, logObject } from "./logger"
import type {
  IServerWebViewRpc,
  IClientServerRpc,
  IServerClientRpc,
  IWebViewServerRpc,
} from "altv-xrpc-shared-types"

export class Rpc extends shared.SharedRpc {
  private readonly clientPendingEvents: Map<alt.Player, PlayerPendingEvents> = new Map()
  private readonly webViewPendingEvents: Map<alt.Player, PlayerPendingEvents> = new Map()

  constructor() {
    super(logObject)

    alt.on("playerDisconnect", this.onPlayerDisconnect.bind(this))

    // TODO: add ts check for events
    alt.onClient(shared.ServerOnClientEvents.CallEvent, this.onClientCallEvent.bind(this))
    alt.onClient(shared.ServerOnClientEvents.EventResponse, this.onClientEventResponse.bind(this))
    alt.onClient(shared.ServerOnClientEvents.WebViewEventResponse, this.onWebViewEventResponse.bind(this))
    alt.onClient(shared.ServerOnClientEvents.CallEventFromWebView, this.onWebViewCallEvent.bind(this))
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

  private async onClientCallEvent(player: alt.Player, rpcName: shared.RpcEventName, args: unknown[]): Promise<void> {
    logger.info("onClientCallEvent", "player:", player.toString(), rpcName)

    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ServerOnClient,
      [player, ...args],
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
    result: unknown,
  ): void {
    const clientPending = this.clientPendingEvents.get(player)?.get(rpcName)

    if (!clientPending) {
      logger.warn(`[onClientEventResponse] rpc name: "${rpcName}" received expired response: ${result}`)
      return
    }

    error
      ? clientPending.reject(`rpc.emitClient rpc name: "${rpcName}" failed, player id: ${player.id}`, error)
      : clientPending.resolve(result)
  }

  private onWebViewEventResponse(
    player: alt.Player,
    rpcName: shared.RpcEventName,
    error: shared.ErrorCodes | null,
    result: unknown,
  ): void {
    const clientPending = this.webViewPendingEvents.get(player)?.get(rpcName)

    if (!clientPending) {
      logger.warn(`[onWebViewEventResponse] rpc name: "${rpcName}" received expired response: ${result}`)
      return
    }

    error
      ? clientPending.reject(`rpc.emitWebView rpc name: "${rpcName}" failed, player id: ${player.id}`, error)
      : clientPending.resolve(result)
  }

  private async onWebViewCallEvent(player: alt.Player, rpcName: shared.RpcEventName, args: unknown[]): Promise<void> {
    logger.info("onWebViewCallEvent", "player:", player.toString(), "rpc:", rpcName)

    const params = await this.callHandlerFromRemoteSide(
      rpcName,
      shared.RpcHandlerType.ServerOnWebView,
      [player, ...args],
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
    alt.emitClient(player, eventName, ...args)
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

  public onClient<K extends keyof IClientServerRpc>(
    rpcName: K,
    handler: (player: alt.Player, ...args: Parameters<IClientServerRpc[K]>) => ReturnType<IClientServerRpc[K]>,
  ): void {
    this.addHandler(rpcName, shared.RpcHandlerType.ServerOnClient, handler as shared.UnknownEventHandler)
  }

  public offClient<K extends keyof IClientServerRpc>(rpcName: K): void {
    this.removeHandler(rpcName, shared.RpcHandlerType.ServerOnClient)
  }

  public onWebView<K extends keyof IWebViewServerRpc>(
    rpcName: K,
    handler: (player: alt.Player, ...args: Parameters<IWebViewServerRpc[K]>) => ReturnType<IWebViewServerRpc[K]>,
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
          timeout: this.defaultTimeout,
        }),
      )

      this.clientPendingEvents.set(player, playerPendingEvents)

      this.emitClientRpcEvent(
        player,
        shared.ClientOnServerEvents.CallEvent,
        [rpcName, args],
      )
    })
  }

  public emitWebView<K extends keyof IServerWebViewRpc>(
    player: alt.Player,
    rpcName: K,
    ...args: Parameters<IServerWebViewRpc[K]>
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
          timeout: this.defaultTimeout,
        }),
      )

      this.webViewPendingEvents.set(player, webViewPendingEvents)

      this.emitClientRpcEvent(
        player,
        shared.ClientOnServerEvents.CallWebViewEvent,
        [rpcName, args],
      )
    })
  }
}
