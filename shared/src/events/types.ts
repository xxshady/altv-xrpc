import type { ServerResponseErrorCodes } from "../errors"
import type { RpcEventName } from "../types"

export interface ISharedOnRemoteEvent {
  "rpc:callEvent" (rpcName: RpcEventName, args: unknown[]): Promise<void>
  "rpc:eventResponse" (rpcName: RpcEventName, error: ServerResponseErrorCodes | null, result: unknown): void
}

export interface IServerOnClientEvent extends ISharedOnRemoteEvent {}
export interface IClientOnServerEvent extends ISharedOnRemoteEvent {}