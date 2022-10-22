enum LogLevel {
  Info,
  Warn,
  Error,
}

export interface ILogObject {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export class Logger {
  public static LogLevel = LogLevel

  private static readonly logTitle = "rpc"

  constructor(
    private readonly logObject: ILogObject,
    private readonly level: LogLevel = ___DEV_MODE ? LogLevel.Info : LogLevel.Warn,
  ) {}

  public info(...args: unknown[]): void {
    if (this.level > LogLevel.Info) return
    this.logObject.info(`[${Logger.logTitle}]`, ...args)
  }

  public warn(...args: unknown[]): void {
    if (this.level > LogLevel.Warn) return
    this.logObject.warn(`[${Logger.logTitle}]`, ...args)
  }

  public error(...args: unknown[]): void {
    if (this.level > LogLevel.Error) return
    this.logObject.error(`[${Logger.logTitle}]`, ...args)
  }
}
