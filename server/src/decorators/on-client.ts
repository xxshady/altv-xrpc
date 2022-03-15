import { defineOnClientTyped, defineOnClientTypedStatic } from "altv-xxdecorators-server"
import { container } from "tsyringe"
import { Rpc } from "../class"

const rpc = container.resolve(Rpc)

export const rpcOnClientTypedSingle = <T>() => 
  defineOnClientTyped<T>('rpcOnClientTyped', (original, rpcName) => {
    rpc.onClient(rpcName, original)
  })

export const rpcOnClientTypedStatic = <T>() => 
  defineOnClientTypedStatic<T>('rpcOnClientTyped', (original, rpcName) => {
    rpc.onClient(rpcName, original)
  })