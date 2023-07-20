import { ErrorCodes } from "../errors"
import { Logger } from "../logger"
import type {
  RawEventHandler,
  RpcHandlerKey,
  RpcHandlerInfoHandler,
  RpcHandlerResult,
  RpcHandlerCallResult,
} from "../types"

const logger = new Logger(console)

export class RpcHandlerInfo {
  private pending = false
  private readonly handler: RpcHandlerInfoHandler
  /**
   * value: +new Date()
   */
  private startHandlerCallTime = 0

  constructor(
    public readonly key: RpcHandlerKey,
    rawHandler: RawEventHandler,
  ) {
    this.handler = this.wrapRawHandler(rawHandler)
  }

  private wrapRawHandler(handler: RawEventHandler): RpcHandlerInfoHandler {
    return async function(...args): Promise<RpcHandlerCallResult> {
      try {
        const res = await handler.apply(handler, args)
        return [null, res]
      }
      catch (e) {
        return [e, null]
      }
    }
  }

  public async startPendingHandler(
    callHandlerArgs: unknown[],
    timeout: number,
  ): Promise<RpcHandlerResult> {
    const errorStartPending = this.setPending(true)

    if (errorStartPending != null)
      return errorStartPending

    this.startHandlerCallTime = +new Date()
    const handlerResult = await this.handler(...callHandlerArgs)
    const handlerCallDelay = (+new Date()) - this.startHandlerCallTime

    this.setPending(false)

    if (handlerCallDelay > timeout)
      return ErrorCodes.Expired

    return handlerResult
  }

  private setPending(value: boolean): ErrorCodes.RemoteAlreadyPending | void {
    if (value === this.pending) {
      return (value
        ? ErrorCodes.RemoteAlreadyPending
        : logger.warn(`key: ${this.key} setPending already false`)
      )
    }

    this.pending = value
  }
}
