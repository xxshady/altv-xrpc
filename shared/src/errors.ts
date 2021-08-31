export enum ErrorCodes {
  Expired = 1,
  CallError,
  AlreadyRegistered,
  AlreadyPending,
  RemoteAlreadyPending,
  HandlerNotRegistered,
  PlayerDisconnected,
}

export type SharedResponseErrorCodes = (
  ErrorCodes.RemoteAlreadyPending |
  ErrorCodes.CallError |
  ErrorCodes.HandlerNotRegistered
)

export type ServerResponseErrorCodes = SharedResponseErrorCodes | ErrorCodes.PlayerDisconnected
export type ClientResponseErrorCodes = SharedResponseErrorCodes

export class RpcError extends Error {
  constructor (
    message: string,
    public readonly code: ErrorCodes,
  ) {
    message = code
      ? (`[rpc] [${ErrorCodes[code]}] ${message}`)
      : (`[rpc] ${message}`)

    super(message)
  }
}
