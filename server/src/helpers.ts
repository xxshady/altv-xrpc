import * as alt from "alt-server"

export const nextTickAsync = (): Promise<void> =>
  new Promise(resolve => alt.nextTick(resolve))
