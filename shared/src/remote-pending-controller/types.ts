import type { RpcEventName, Resolver, Rejecter } from "../types"

export interface IOptions {
  rpcName: RpcEventName
  resolve: Resolver<any>
  reject: Rejecter
  finish: (result: unknown) => void
  timeout: number
}