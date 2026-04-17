/**
 * Auth Helpers 统一导出
 *
 * @module utils/authHelpers
 */

export {
  parseLoginResponse,
  mapOrgTypeToRole,
  mapBackendUser,
  isKnownUserRole
} from './responseParser'
export type { LoginResponseData, ParseResult } from './responseParser'
