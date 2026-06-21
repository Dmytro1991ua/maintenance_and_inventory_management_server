import type jwt from "jsonwebtoken";

export type BcryptHashFn = (data: string, saltOrRounds: string | number) => Promise<string>;
export type BcryptCompareFn = (data: string, encrypted: string) => Promise<boolean>;
export type JwtSignFn = (
  payload: string | object | Buffer,
  secretOrPrivateKey: jwt.Secret,
  options?: jwt.SignOptions,
) => string;
export type JwtVerifyFn = (token: string, secretOrPublicKey: jwt.Secret) => jwt.JwtPayload | string;
export type JwtDecodeFn = (token: string) => jwt.JwtPayload | string | null;
