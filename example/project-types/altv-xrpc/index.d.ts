declare module "altv-xrpc-shared-types" {
  // interface for rpc sent from the client side to the server side
  export interface IClientServerRpc {
    example(a: number): string
  }
}
