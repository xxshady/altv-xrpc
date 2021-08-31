import alt from "alt-client"
import * as rpc from "altv-xrpc-shared"
import { onServerTyped } from "altv-xdecorators-client"
import type { ServerPendingEvents } from "./types"

export class Rpc extends rpc.SharedRpc {
  private static onServerRpcEvent = onServerTyped<rpc.IClientOnServerEvent>()

  private readonly serverPendingEvents: ServerPendingEvents = new Map()

  @Rpc.onServerRpcEvent(rpc.ClientOnServerEvents.callEvent)
  protected async onServerCallEvent (rpcName: rpc.RpcEventName, args: unknown[]): Promise<void> {
    const params = await this.callHandlerFromRemoteSide(rpcName, rpc.RpcHandlerType.onServer, args)
    if (!params) return

    this.emitServerRpcEvent(rpc.ServerOnClientEvents.eventResponse, params)
  }

  @Rpc.onServerRpcEvent(rpc.ClientOnServerEvents.eventResponse)
  protected onServerEventResponse (rpcName: rpc.RpcEventName, error: rpc.ErrorCodes | null, result: unknown): void {
    const serverPending = this.serverPendingEvents.get(rpcName)

    if (!serverPending) {
      this.log.warn(`[onServerEventResponse] rpc name: ${rpcName} received expired response: ${result}`)
      return
    }

    error
      ? serverPending.reject(`rpc.emitServer rpc name: ${rpcName} failed`, error)
      : serverPending.resolve(result)
  }

  private emitServerRpcEvent <K extends keyof rpc.IServerOnClientEvent> (
    eventName: K,
    args: Parameters<rpc.IServerOnClientEvent[K]>,
  ): void {
    alt.emitServer(eventName, ...args)
  }

  private checkPendingServerEvent (rpcName: rpc.RpcEventName): rpc.RemotePendingController | undefined {
    const serverPendingEvent = this.serverPendingEvents.get(rpcName)

    if (serverPendingEvent) {
      throw new rpc.RpcError(`rpc name: ${rpcName}`, rpc.ErrorCodes.AlreadyPending)
    }

    return serverPendingEvent
  }

  public onServer (rpcName: rpc.RpcEventName, handler: rpc.UnknownEventHandler): void {
    this.addHandler(rpcName, rpc.RpcHandlerType.onServer, handler)
  }

  public offServer (rpcName: rpc.RpcEventName): void {
    this.removeHandler(rpcName, rpc.RpcHandlerType.onServer)
  }

  public emitServer <T extends (...args: any[]) => unknown> (rpcName: string, ...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      const serverPending: rpc.RemotePendingController = this.checkPendingServerEvent(rpcName) ||
      new rpc.RemotePendingController({
        rpcName,
        resolve,
        reject,
        finish: (result: unknown): void => {
          this.serverPendingEvents.delete(rpcName)

          this.log.log(
            `rpc name: ${rpcName} finished with result: ~gl~` +
            `${(result as any)?.constructor?.name} ${JSON.stringify(result)}`,
          )
        },
        timeout: this.defaultTimeout,
      })

      this.serverPendingEvents.set(rpcName, serverPending)
      this.emitServerRpcEvent(rpc.ServerOnClientEvents.callEvent, [rpcName, args])
    })
  }
}