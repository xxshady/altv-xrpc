import * as alt from "alt-client"
import * as shared from "altv-xrpc-shared"

export const logObject = {
  info: alt.log,
  warn: alt.logWarning,
  error: alt.logError,
}

export const logger = new shared.Logger(logObject)
