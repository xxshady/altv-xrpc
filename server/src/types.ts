import type * as alt from "alt-server"
import type {
  RpcEventName,
  RemotePendingController,
  IServerOnClientEvent,
  IClientOnServerEvent,
} from "altv-xrpc-shared"

export type PlayerPendingEvents = Map<RpcEventName, RemotePendingController>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddPlayerToHandler<T extends (...args: any[]) => any> = (player: alt.Player, ...args: Parameters<T>) => ReturnType<T>

export type ServerOnClientEvent = {
  [K in keyof IServerOnClientEvent]: AddPlayerToHandler<IServerOnClientEvent[K]>
}

export type ToggleEventHandler = <K extends keyof ServerOnClientEvent>(event: K, handler: ServerOnClientEvent[K]) => void

export interface IEventApi {
  onClient: ToggleEventHandler
  offClient: ToggleEventHandler
  emitClient: <K extends keyof IClientOnServerEvent>(
    player: alt.Player,
    event: K,
    ...args: Parameters<IClientOnServerEvent[K]>
  ) => void
}
