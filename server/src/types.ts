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

// return value of rpc handler
type Response = unknown

export interface IHooks {
  clientServerCall?: (player: alt.Player, rpcName: RpcEventName, args: unknown[]) => { player: unknown; args: unknown[] } | null
  serverClientResponse?: (player: alt.Player, rpcName: RpcEventName, response: Response) => { response: Response } | null
  serverWebViewResponse?: (player: alt.Player, rpcName: RpcEventName, response: Response) => { response: Response } | null
  webViewServerCall?: (player: alt.Player, rpcName: RpcEventName, args: unknown[]) => { player: unknown; args: unknown[] } | null
}
