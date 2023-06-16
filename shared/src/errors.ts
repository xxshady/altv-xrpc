export enum ErrorCodes {
  Expired = 1,
  CallError,
  AlreadyRegistered,
  AlreadyPending,
  RemoteAlreadyPending,
  HandlerNotRegistered,
  PlayerDisconnected,
  WebViewNotAdded,
  InvalidClientServerArgsOrPlayer,
  InvalidServerClientResponse,
}

export class RpcError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCodes,
  ) {
    message = code
      ? (`[rpc] [error: ${ErrorCodes[code]}] ${message}`)
      : (`[rpc] ${message}`)

    super(message)
  }
}
