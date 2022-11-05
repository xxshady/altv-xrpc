declare module "altv-xrpc-shared-types" {
  /**
   * For client -> server rpc
   */
  export interface IClientServerRpc {}

  /**
   * For server -> client rpc
   */
  export interface IServerClientRpc {}

  /**
   * For server -> webview rpc
   */
  export interface IServerWebViewRpc {}

  /**
   * For client -> webview rpc
   */
  export interface IClientWebViewRpc {}

  /**
   * For webview -> client rpc
   */
  export interface IWebViewClientRpc {}

  /**
   * For webview -> server rpc
   */
  export interface IWebViewServerRpc {}
}
