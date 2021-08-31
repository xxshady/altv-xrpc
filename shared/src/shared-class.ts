import alt from "alt-shared"
import { ErrorCodes, RpcError } from "./errors"
import { LogLevel, createLogger } from "altv-xlogger"
import type {
  RpcEventName,
  RpcHandlerKey,
  RpcHandlerResult,
  SharedEventResponseParams,
  UnknownEventHandler
} from "./types"
import type { RpcHandlerType } from "./enums"
import { RpcHandlerInfo } from "./rpc-handler-info"
import { defaultTimeout } from "./constants"

export class SharedRpc {
  public readonly defaultTimeout = defaultTimeout
  public readonly ErrorCodes = ErrorCodes
  public readonly RpcError = RpcError

  protected readonly log = createLogger("rpc", { logLevel: alt.debug ? LogLevel.Info : LogLevel.Warn })
  protected readonly handlers: Map<RpcHandlerKey, RpcHandlerInfo> = new Map()

  protected addHandler <T extends RpcHandlerType> (
    rpcName: RpcEventName,
    handlerType: T,
    handler: UnknownEventHandler,
  ): void {
    const key = this.createRpcKeyFromName(rpcName, handlerType)

    this.registerRpcKeyHandler(key, handler)
  }

  protected removeHandler <T extends RpcHandlerType> (
    rpcName: RpcEventName,
    handlerType: T,
  ): void {
    const key = this.createRpcKeyFromName(rpcName, handlerType)

    if (!this.handlers.delete(key)) {
      throw new RpcError(`rpc key: ${key}`, ErrorCodes.HandlerNotRegistered)
    }
  }

  protected async callHandler <T extends RpcHandlerType> (
    eventName: string,
    handlerType: T,
    args: unknown[],
  ): Promise<RpcHandlerResult> {
    const key = this.createRpcKeyFromName(eventName, handlerType)
    const handlerInfo = this.getRpcHandlerInfoByKey(key)

    if (!handlerInfo) {
      return ErrorCodes.HandlerNotRegistered
    }

    return await handlerInfo.startPendingHandler(...args)
  }

  protected async callHandlerFromRemoteSide <T extends RpcHandlerType> (
    rpcName: RpcEventName,
    handlerType: T,
    args: unknown[],
  ): Promise<SharedEventResponseParams | void> {
    const result = await this.callHandler(rpcName, handlerType, args)
    return this.handleCallHandlerResultFromRemoteSide(rpcName, result)
  }

  private handleCallHandlerResultFromRemoteSide (
    rpcName: RpcEventName,
    result: RpcHandlerResult,
  ): SharedEventResponseParams | void {
    let params: SharedEventResponseParams

    if (typeof result === "number") {
      if (result === ErrorCodes.Expired) {
        this.log.warn(`[Expired] rpc name: ${rpcName} call handler duration was too long > ${defaultTimeout} ms`)
        return
      }

      params = [rpcName, result, null]
    } else {
      const [error, callHandlerResult] = result

      if (error) {
        this.log.error(`[CallError] rpc name: ${rpcName} handler error: ${error.stack}`)

        params = [rpcName, ErrorCodes.CallError, null]
      } else {
        params = [rpcName, null, callHandlerResult]
      }
    }

    return params
  }

  protected createRpcKeyFromName <T extends RpcHandlerType> (
    rpcName: string,
    type: T,
  ): RpcHandlerKey {
    return `${type}-${rpcName}`
  }

  protected registerRpcKeyHandler (key: RpcHandlerKey, handler: UnknownEventHandler): void {
    if (this.handlers.get(key)) {
      throw new RpcError(`rpc key: ${key}`, ErrorCodes.AlreadyRegistered)
    }

    this.handlers.set(key, new RpcHandlerInfo(key, handler))
  }

  protected getRpcHandlerInfoByKey (key: RpcHandlerKey): RpcHandlerInfo | undefined {
    return this.handlers.get(key)
  }
}