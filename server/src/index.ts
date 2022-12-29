import * as alt from "alt-server"
import { Rpc } from "./class"
export { Rpc } from "./class"

export const rpc = new Rpc({
  eventApi: {
    emitClient: alt.emitClient,
    offClient: alt.offClient,
    onClient: alt.onClient,
  },
})
