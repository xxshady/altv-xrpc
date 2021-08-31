import { defineTypedEventDecorator } from "altv-xdecorators-shared"
import { container } from "tsyringe"
import { Rpc } from "../class"

const rpc = container.resolve(Rpc)

export const rpcOnServerTyped = <T>() => 
  defineTypedEventDecorator('rpcOnServerTyped', (original, rpcName) => {
    rpc.onServer(rpcName, original)
  })<T>()