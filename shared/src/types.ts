import type { RpcHandlerType } from "./enums"
import type { ErrorCodes, RpcError, SharedResponseErrorCodes } from "./errors"
import type { ISharedOnRemoteEvent } from "./events"

export type Resolver<T> = (value: T) => void
export type Rejecter = (reason: RpcError) => void

export type RpcEventName = string

export type RpcHandlerKey<T extends RpcHandlerType = RpcHandlerType> = `${T}-${RpcEventName}`

export type RpcHandlerCallResult = [error: Error | null, result: unknown | null]
export type RpcHandlerCallFail = SharedResponseErrorCodes | ErrorCodes.Expired
export type RpcHandlerResult = RpcHandlerCallResult | RpcHandlerCallFail

export type RpcHandlerInfoHandler = (...args: any[]) => RpcHandlerCallResult | Promise<RpcHandlerCallResult>

export type RawEventHandler = (...args: any[]) => unknown

export type SharedEventResponseParams = Parameters<ISharedOnRemoteEvent["rpc:eventResponse"]>

export type UnknownEventHandler = (...args: any[]) => unknown