import { container } from "tsyringe"
import { Rpc } from "./class"

export const rpc = container.resolve(Rpc)

export * from './decorators'