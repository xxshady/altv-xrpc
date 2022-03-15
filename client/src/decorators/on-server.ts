import { defineTypedEventDecorator } from "altv-xxdecorators-shared"
import { container } from "tsyringe"
import { Rpc } from "../class"

const rpc = container.resolve(Rpc)

export const rpcOnServerTypedSingle = <T>() => 
  defineTypedEventDecorator('rpcOnServerTyped', (original, rpcName) => {
    rpc.onServer(rpcName, original)
  })<T>()