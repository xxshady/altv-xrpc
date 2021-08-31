import alt from "alt-server"
import * as rpc from "altv-xrpc-shared"
import { onAlt, onClientTyped } from "@xshady/altv-decorators-server"
import type { PlayerPendingEvents } from "./types"
import { nextTickAsync } from "./helpers"

export class Rpc extends rpc.SharedRpc {
  private static readonly onClientRpcEvent = onClientTyped<rpc.IServerOnClientEvent>()

  private readonly clientPendingEvents: Map<alt.Player, PlayerPendingEvents> = new Map()

  @onAlt("playerDisconnect")
  protected async playerDisconnect (player: alt.Player, reason: string): Promise<void> {
    const playerPendingEvents = this.clientPendingEvents.get(player)
    if (!playerPendingEvents) return

    await nextTickAsync()

    playerPendingEvents.forEach(
      clientPending => {
        clientPending.reject(
          `rpc name: ${clientPending.rpcName}`,
          rpc.ErrorCodes.PlayerDisconnected,
          false,
        )
      })

    this.clientPendingEvents.delete(player)
  }

  @Rpc.onClientRpcEvent(rpc.ServerOnClientEvents.callEvent)
  protected async onClientCallEvent (player: alt.Player, rpcName: rpc.RpcEventName, args: unknown[]): Promise<void> {
    this.log.log("onClientCallEvent", "player:", player.toString(), rpcName)

    const params = await this.callHandlerFromRemoteSide(rpcName, rpc.RpcHandlerType.onClient, [player, ...args])

    this.log.log("callHandlerFromRemoteSide params return:", params)

    if (!params) return
    if (!player.valid) return

    this.emitClientRpcEvent(player, rpc.ClientOnServerEvents.eventResponse, params)
  }

  @Rpc.onClientRpcEvent(rpc.ServerOnClientEvents.eventResponse)
  protected onClientEventResponse (
    player: alt.Player,
    rpcName: rpc.RpcEventName,
    error: rpc.ServerResponseErrorCodes | null,
    result: unknown,
  ): void {
    const clientPending = this.clientPendingEvents.get(player)?.get(rpcName)

    if (!clientPending) {
      this.log.warn(`[onClientEventResponse] rpc name: ${rpcName} received expired response: ${result}`)
      return
    }

    error
      ? clientPending.reject(`rpc.emitClient rpc name: ${rpcName} player id: ${player.id} failed`, error)
      : clientPending.resolve(result)
  }

  private emitClientRpcEvent <K extends keyof rpc.IClientOnServerEvent> (
    player: alt.Player,
    eventName: K,
    args: Parameters<rpc.IClientOnServerEvent[K]>,
  ): void {
    this.log.log("emitClientRpcEvent", player.toString(), eventName, args)
    alt.emitClient(player, eventName, ...args)
  }

  private getPlayerPendingEvents (player: alt.Player): PlayerPendingEvents | undefined {
    return this.clientPendingEvents.get(player)
  }

  private checkPendingClientEvent (player: alt.Player, rpcName: rpc.RpcEventName): PlayerPendingEvents | undefined {
    const playerPendingEvents = this.getPlayerPendingEvents(player)

    if (playerPendingEvents?.has(rpcName)) {
      throw new rpc.RpcError(`rpc name: ${rpcName}`, rpc.ErrorCodes.AlreadyPending)
    }

    return playerPendingEvents
  }

  public onClient (rpcName: rpc.RpcEventName, handler: rpc.UnknownEventHandler): void {
    this.addHandler(rpcName, rpc.RpcHandlerType.onClient, handler)
  }

  public offClient (rpcName: rpc.RpcEventName): void {
    this.removeHandler(rpcName, rpc.RpcHandlerType.onClient)
  }

  public emitClient <T extends (...args: any[]) => unknown> (
    player: alt.Player,
    rpcName: rpc.RpcEventName,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      if (!player.valid) {
        reject(new rpc.RpcError(`rpc name: ${rpcName}`, this.ErrorCodes.PlayerDisconnected))
        return
      }

      const playerPendingEvents: PlayerPendingEvents = this.checkPendingClientEvent(
        player,
        rpcName,
      ) || new Map()

      playerPendingEvents.set(
        rpcName,
        new rpc.RemotePendingController({
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

      this.emitClientRpcEvent(player, rpc.ClientOnServerEvents.callEvent, [rpcName, args])
    })
  }
}