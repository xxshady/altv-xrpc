import alt from "alt-server"

export const nextTickAsync = () => 
    new Promise(resolve => alt.nextTick(resolve))