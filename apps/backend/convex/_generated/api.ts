/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as crypto from "../crypto.js";
import type * as errors from "../errors.js";
import type * as lists from "../lists.js";
import type * as maintenance from "../maintenance.js";
import type * as sync from "../sync.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  constants: typeof constants;
  crons: typeof crons;
  crypto: typeof crypto;
  errors: typeof errors;
  lists: typeof lists;
  maintenance: typeof maintenance;
  sync: typeof sync;
  tasks: typeof tasks;
  users: typeof users;
  validation: typeof validation;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
};
