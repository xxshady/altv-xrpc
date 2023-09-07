import { ErrorCodes } from "../errors"
import { Logger } from "../logger"
import type {
  RawEventHandler,
  RpcHandlerKey,
  RpcHandlerInfoHandler,
  RpcHandlerResult,
  RpcHandlerCallResult,
  RpcEventName,
} from "../types"

const logger = new Logger(console)

export class RpcHandlerInfo {
  private pending = false
  private readonly handler: RpcHandlerInfoHandler
  /**
   * value: +new Date()
   */
  private startHandlerCallTime = 0
  private currentTimeout: number | null = null
  private currentCallId = Symbol("initial")

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
    rpcName: RpcEventName,
    callHandlerArgs: unknown[],
    timeout: number,
  ): Promise<RpcHandlerResult> {
    const startPendingError = this.setPending(true)

    if (startPendingError != null) {
      if (startPendingError !== ErrorCodes.RemoteAlreadyPending) return startPendingError

      const currentTimeout = this.currentTimeout
      if (currentTimeout == null)
        throw new Error("[startPendingHandler] this.currentTimeout must be defined")
      const duration = this.getCallDuration()

      // logger.info("[startPendingHandler]", {
      //   duration,
      //   currentTimeout: currentTimeout,
      // })

      if (duration < currentTimeout) return startPendingError

      logger.warn(`[Expired] rpc name: "${rpcName}" call handler duration was too long > ${currentTimeout} ms (starting new call)`)
    }

    this.startHandlerCallTime = +new Date()
    this.currentTimeout = timeout

    const currentCallId = Symbol("currentCallId")
    this.currentCallId = currentCallId

    const handlerResult = await this.handler(...callHandlerArgs)

    if (this.currentCallId !== currentCallId) {
      logger.warn(`Some old call of rpc: "${rpcName}" was resolved`)
      return ErrorCodes.Expired
    }

    const handlerCallDuration = this.getCallDuration()

    this.setPending(false)

    if (handlerCallDuration > timeout) return ErrorCodes.Expired
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

    if (!value)
      this.currentTimeout = null
  }

  private getCallDuration(): number {
    return (+new Date()) - this.startHandlerCallTime
  }
}
