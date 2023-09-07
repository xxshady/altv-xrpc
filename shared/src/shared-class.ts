import { ErrorCodes, RpcError } from "./errors"
import type {
  RpcEventName,
  RpcHandlerKey,
  RpcHandlerResult,
  SharedEventResponseParams,
  UnknownEventHandler,
} from "./types"
import type { RpcHandlerType } from "./enums"
import { RpcHandlerInfo } from "./rpc-handler-info"
import { defaultTimeout } from "./constants"
import type { ILogObject } from "./logger"
import { Logger } from "./logger"

export class SharedRpc {
  public readonly defaultTimeout = defaultTimeout
  public readonly ErrorCodes = ErrorCodes
  public readonly RpcError = RpcError

  protected readonly handlers: Map<RpcHandlerKey, RpcHandlerInfo> = new Map()
  private readonly logger: Logger

  constructor(logObject: ILogObject = console) {
    this.logger = new Logger(logObject)
  }

  protected addHandler<T extends RpcHandlerType>(
    rpcName: RpcEventName,
    handlerType: T,
    handler: UnknownEventHandler,
  ): void {
    const key = this.createRpcKeyFromName(rpcName, handlerType)

    this.registerRpcKeyHandler(key, handler)
  }

  protected removeHandler<T extends RpcHandlerType>(
    rpcName: RpcEventName,
    handlerType: T,
  ): void {
    const key = this.createRpcKeyFromName(rpcName, handlerType)

    if (!this.handlers.delete(key))
      throw new RpcError(`rpc key: ${key}`, ErrorCodes.HandlerNotRegistered)
  }

  protected async callHandler<T extends RpcHandlerType>(
    eventName: string,
    handlerType: T,
    args: unknown[],
    timeout: number,
  ): Promise<RpcHandlerResult> {
    const key = this.createRpcKeyFromName(eventName, handlerType)
    const handlerInfo = this.getRpcHandlerInfoByKey(key)

    if (!handlerInfo)
      return ErrorCodes.HandlerNotRegistered

    return await handlerInfo.startPendingHandler(eventName, args, timeout)
  }

  protected async callHandlerFromRemoteSide<T extends RpcHandlerType>(
    rpcName: RpcEventName,
    handlerType: T,
    args: unknown[],
    timeout: number,
  ): Promise<SharedEventResponseParams | undefined> {
    const result = await this.callHandler(rpcName, handlerType, args, timeout)
    return this.handleCallHandlerResultFromRemoteSide(rpcName, result, timeout)
  }

  private handleCallHandlerResultFromRemoteSide(
    rpcName: RpcEventName,
    result: RpcHandlerResult,
    timeout: number,
  ): SharedEventResponseParams | undefined {
    let params: SharedEventResponseParams

    if (typeof result === "number") {
      if (result === ErrorCodes.Expired) {
        this.logger.warn(`[Expired] rpc name: "${rpcName}" call handler duration was too long > ${timeout} ms`)
        return
      }

      params = [rpcName, result, null]
    }
    else {
      const [error, callHandlerResult] = result

      if (error) {
        this.logger.error(`[CallError] rpc name: "${rpcName}" handler error: ${error.stack}`)

        params = [rpcName, ErrorCodes.CallError, null]
      }
      else
        params = [rpcName, null, callHandlerResult]
    }

    return params
  }

  protected createRpcKeyFromName<T extends RpcHandlerType>(
    rpcName: string,
    type: T,
  ): RpcHandlerKey {
    return `${type}-${rpcName}`
  }

  protected registerRpcKeyHandler(key: RpcHandlerKey, handler: UnknownEventHandler): void {
    if (this.handlers.has(key))
      throw new RpcError(`rpc key: ${key}`, ErrorCodes.AlreadyRegistered)

    this.handlers.set(key, new RpcHandlerInfo(key, handler))
  }

  protected getRpcHandlerInfoByKey(key: RpcHandlerKey): RpcHandlerInfo | undefined {
    return this.handlers.get(key)
  }
}
