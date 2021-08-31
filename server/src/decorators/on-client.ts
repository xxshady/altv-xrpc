import { defineOnClientTyped } from "@xshady/altv-decorators-server"
import { container } from "tsyringe"
import { Rpc } from "../class"

const rpc = container.resolve(Rpc)

export const rpcOnClientTyped = <T>() => 
  defineOnClientTyped<T>('rpcOnClientTyped', (original, rpcName) => {
    rpc.onClient(rpcName, original)
  })