import { ErrorCodes, RpcError } from "../errors"
import { Logger } from "../logger"
import type { IOptions } from "./types"

const logger = new Logger(console)

export class RemotePendingController {
  private timer: number | null
  public readonly rpcName: IOptions["rpcName"]
  private readonly resolvePromise: IOptions["resolve"]
  private readonly rejectPromise: IOptions["reject"]
  public readonly finishPending: IOptions["finish"]
  public readonly timeout: IOptions["timeout"]

  private _finished = false

  constructor({
    rpcName,
    resolve,
    reject,
    timeout,
    finish,
  }: IOptions) {
    this.rpcName = rpcName
    this.resolvePromise = resolve
    this.rejectPromise = reject
    this.finishPending = finish
    this.timeout = timeout
    this.timer = this.initTimer()
  }

  private initTimer(): number {
    return setTimeout(() => {
      this.timer = null
      this.reject(`event: ${this.rpcName}`, ErrorCodes.Expired)
    }, this.timeout)
  }

  private clearTimer(): void {
    if (this.timer == null) return
    clearTimeout(this.timer)
    this.timer = null
  }

  public reject(reasonMessage: string, errorCode: ErrorCodes, useFinishPending = true): void {
    const finishResult = new RpcError(reasonMessage, errorCode)

    if (!this.finish(finishResult, useFinishPending)) return

    this.clearTimer()
    this.rejectPromise(finishResult)
  }

  public resolve(value: unknown): void {
    if (!this.finish(value)) return

    this.clearTimer()
    this.resolvePromise(value)
  }

  public finish(result: unknown, useFinishPending = true): boolean {
    if (this._finished) {
      logger.warn(`[finish] rpc name: "${this.rpcName}" already finished`)
      return false
    }
    this._finished = true

    if (useFinishPending) this.finishPending(result)

    return true
  }
}
